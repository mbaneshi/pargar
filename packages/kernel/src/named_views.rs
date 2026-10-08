use crate::commands::CommandResult;
use crate::entity::NamedView;
use crate::events::CadEvent;
use crate::Kernel;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
impl Kernel {
    pub fn get_named_views_json(&self) -> String {
        let list: Vec<&NamedView> = self.named_views.values().collect();
        serde_json::to_string(&list).unwrap_or_default()
    }
}

impl Kernel {
    pub(crate) fn save_named_view_cmd(
        &mut self,
        name: &str,
        center_x: f64,
        center_y: f64,
        zoom: f64,
        rotation: Option<f64>,
    ) -> CommandResult {
        if name.is_empty() {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("View name cannot be empty".to_string()),
                measurement: None,
                warnings: vec![],
            };
        }
        let new_view = NamedView {
            name: name.to_string(),
            center_x,
            center_y,
            zoom,
            rotation: rotation.unwrap_or(0.0),
        };
        match self.named_views.get(name).cloned() {
            Some(old) => {
                self.event_store.push(CadEvent::NamedViewModified {
                    old_view: old,
                    new_view: new_view.clone(),
                });
            }
            None => {
                self.event_store.push(CadEvent::NamedViewCreated {
                    view: new_view.clone(),
                });
            }
        }
        self.named_views.insert(name.to_string(), new_view);
        CommandResult {
            success: true,
            created_ids: vec![name.to_string()],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub(crate) fn delete_named_view_cmd(&mut self, name: &str) -> CommandResult {
        match self.named_views.remove(name) {
            Some(view) => {
                self.event_store.push(CadEvent::NamedViewDeleted { view });
                CommandResult {
                    success: true,
                    created_ids: vec![],
                    error: None,
                    measurement: None,
                    warnings: vec![],
                }
            }
            None => CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Named view '{}' not found", name)),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    pub(crate) fn rename_named_view_cmd(
        &mut self,
        old_name: &str,
        new_name: &str,
    ) -> CommandResult {
        if self.named_views.contains_key(new_name) {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Named view '{}' already exists", new_name)),
                measurement: None,
                warnings: vec![],
            };
        }
        let old = match self.named_views.remove(old_name) {
            Some(v) => v,
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("Named view '{}' not found", old_name)),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };
        let mut new_view = old.clone();
        new_view.name = new_name.to_string();
        self.event_store.push(CadEvent::NamedViewModified {
            old_view: old,
            new_view: new_view.clone(),
        });
        self.named_views.insert(new_name.to_string(), new_view);
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::Kernel;

    fn exec(k: &mut Kernel, json: &str) -> serde_json::Value {
        let r = k.execute_command(json);
        serde_json::from_str(&r).unwrap()
    }

    #[test]
    fn no_views_initially() {
        let k = Kernel::new();
        assert!(k.named_views.is_empty());
    }

    #[test]
    fn save_named_view() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SaveNamedView","name":"Front","center_x":100,"center_y":50,"zoom":25}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        let view = k.named_views.get("Front").unwrap();
        assert_eq!(view.center_x, 100.0);
        assert_eq!(view.zoom, 25.0);
        assert_eq!(view.rotation, 0.0);
    }

    #[test]
    fn save_named_view_with_rotation() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SaveNamedView","name":"R","center_x":0,"center_y":0,"zoom":1,"rotation":1.5}"#,
        );
        assert_eq!(k.named_views.get("R").unwrap().rotation, 1.5);
    }

    #[test]
    fn save_empty_name_fails() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SaveNamedView","name":"","center_x":0,"center_y":0,"zoom":1}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn delete_named_view() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SaveNamedView","name":"X","center_x":0,"center_y":0,"zoom":1}"#,
        );
        let v = exec(&mut k, r#"{"type":"DeleteNamedView","name":"X"}"#);
        assert!(v["success"].as_bool().unwrap());
        assert!(!k.named_views.contains_key("X"));
    }

    #[test]
    fn rename_named_view() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SaveNamedView","name":"Old","center_x":1,"center_y":2,"zoom":3}"#,
        );
        let v = exec(
            &mut k,
            r#"{"type":"RenameNamedView","old_name":"Old","new_name":"New"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert!(!k.named_views.contains_key("Old"));
        let nv = k.named_views.get("New").unwrap();
        assert_eq!(nv.center_x, 1.0);
    }

    #[test]
    fn rename_to_existing_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SaveNamedView","name":"A","center_x":0,"center_y":0,"zoom":1}"#,
        );
        exec(
            &mut k,
            r#"{"type":"SaveNamedView","name":"B","center_x":0,"center_y":0,"zoom":1}"#,
        );
        let v = exec(
            &mut k,
            r#"{"type":"RenameNamedView","old_name":"A","new_name":"B"}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn save_overwrites_with_modified_event() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SaveNamedView","name":"X","center_x":0,"center_y":0,"zoom":1}"#,
        );
        let before = k.event_store.event_count();
        exec(
            &mut k,
            r#"{"type":"SaveNamedView","name":"X","center_x":99,"center_y":99,"zoom":50}"#,
        );
        assert_eq!(k.event_store.event_count(), before + 1);
        assert_eq!(k.named_views.get("X").unwrap().center_x, 99.0);
    }
}
