use crate::commands::CommandResult;
use crate::entity::{NamedUcs, Point2D};
use crate::events::CadEvent;
use crate::Kernel;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
impl Kernel {
    pub fn get_named_ucs_json(&self) -> String {
        let list: Vec<&NamedUcs> = self.named_ucs.values().collect();
        serde_json::to_string(&list).unwrap_or_default()
    }

    pub fn get_current_ucs(&self) -> String {
        self.current_ucs.clone()
    }
}

fn normalize_axis(x: f64, y: f64) -> (f64, f64) {
    let len = (x * x + y * y).sqrt();
    if len > 1e-12 {
        (x / len, y / len)
    } else {
        (1.0, 0.0)
    }
}

impl Kernel {
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn save_ucs_cmd(
        &mut self,
        name: &str,
        origin_x: f64,
        origin_y: f64,
        x_axis_x: f64,
        x_axis_y: f64,
        y_axis_x: f64,
        y_axis_y: f64,
    ) -> CommandResult {
        if name == "World" {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Cannot redefine the World UCS".to_string()),
                measurement: None,
                warnings: vec![],
            };
        }
        let (xx, xy) = normalize_axis(x_axis_x, x_axis_y);
        let (yx, yy) = normalize_axis(y_axis_x, y_axis_y);
        let new_ucs = NamedUcs {
            name: name.to_string(),
            origin: Point2D::new(origin_x, origin_y),
            x_axis: Point2D::new(xx, xy),
            y_axis: Point2D::new(yx, yy),
        };
        match self.named_ucs.get(name).cloned() {
            Some(old) => {
                self.event_store.push(CadEvent::NamedUcsModified {
                    old_ucs: old,
                    new_ucs: new_ucs.clone(),
                });
            }
            None => {
                self.event_store.push(CadEvent::NamedUcsCreated {
                    ucs: new_ucs.clone(),
                });
            }
        }
        self.named_ucs.insert(name.to_string(), new_ucs);
        CommandResult {
            success: true,
            created_ids: vec![name.to_string()],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub(crate) fn delete_ucs_cmd(&mut self, name: &str) -> CommandResult {
        if name == "World" {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Cannot delete the World UCS".to_string()),
                measurement: None,
                warnings: vec![],
            };
        }
        match self.named_ucs.remove(name) {
            Some(ucs) => {
                self.event_store.push(CadEvent::NamedUcsDeleted { ucs });
                if self.current_ucs == name {
                    self.current_ucs = "World".to_string();
                }
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
                error: Some(format!("UCS '{}' not found", name)),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    pub(crate) fn set_current_ucs_cmd(&mut self, name: &str) -> CommandResult {
        if name == "World" || self.named_ucs.contains_key(name) {
            self.current_ucs = name.to_string();
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        } else {
            CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("UCS '{}' not found", name)),
                measurement: None,
                warnings: vec![],
            }
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
    fn world_is_default_current_ucs() {
        let k = Kernel::new();
        assert_eq!(k.current_ucs, "World");
        assert!(k.named_ucs.is_empty());
    }

    #[test]
    fn save_ucs_normalizes_axes() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SaveUcs","name":"Site","origin_x":100,"origin_y":50,"x_axis_x":3,"x_axis_y":0,"y_axis_x":0,"y_axis_y":4}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        let ucs = k.named_ucs.get("Site").unwrap();
        assert!((ucs.x_axis.x - 1.0).abs() < 1e-9);
        assert!((ucs.y_axis.y - 1.0).abs() < 1e-9);
    }

    #[test]
    fn save_world_ucs_fails() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SaveUcs","name":"World","origin_x":0,"origin_y":0,"x_axis_x":1,"x_axis_y":0,"y_axis_x":0,"y_axis_y":1}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn delete_ucs() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SaveUcs","name":"X","origin_x":0,"origin_y":0,"x_axis_x":1,"x_axis_y":0,"y_axis_x":0,"y_axis_y":1}"#,
        );
        let v = exec(&mut k, r#"{"type":"DeleteUcs","name":"X"}"#);
        assert!(v["success"].as_bool().unwrap());
        assert!(!k.named_ucs.contains_key("X"));
    }

    #[test]
    fn delete_world_ucs_fails() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"DeleteUcs","name":"World"}"#);
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn set_current_ucs_world() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SaveUcs","name":"Site","origin_x":10,"origin_y":10,"x_axis_x":1,"x_axis_y":0,"y_axis_x":0,"y_axis_y":1}"#,
        );
        exec(&mut k, r#"{"type":"SetCurrentUcs","name":"Site"}"#);
        assert_eq!(k.get_current_ucs(), "Site");
        exec(&mut k, r#"{"type":"SetCurrentUcs","name":"World"}"#);
        assert_eq!(k.get_current_ucs(), "World");
    }

    #[test]
    fn set_current_ucs_nonexistent() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"SetCurrentUcs","name":"Nope"}"#);
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn delete_current_resets_to_world() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SaveUcs","name":"Site","origin_x":0,"origin_y":0,"x_axis_x":1,"x_axis_y":0,"y_axis_x":0,"y_axis_y":1}"#,
        );
        exec(&mut k, r#"{"type":"SetCurrentUcs","name":"Site"}"#);
        exec(&mut k, r#"{"type":"DeleteUcs","name":"Site"}"#);
        assert_eq!(k.get_current_ucs(), "World");
    }

    #[test]
    fn save_ucs_overwrites_with_modified_event() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SaveUcs","name":"X","origin_x":0,"origin_y":0,"x_axis_x":1,"x_axis_y":0,"y_axis_x":0,"y_axis_y":1}"#,
        );
        exec(
            &mut k,
            r#"{"type":"SaveUcs","name":"X","origin_x":50,"origin_y":50,"x_axis_x":1,"x_axis_y":0,"y_axis_x":0,"y_axis_y":1}"#,
        );
        assert_eq!(k.named_ucs.get("X").unwrap().origin.x, 50.0);
    }
}
