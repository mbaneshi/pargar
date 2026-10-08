use crate::commands::CommandResult;
use crate::entity::MLeaderStyle;
use crate::events::CadEvent;
use crate::Kernel;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
impl Kernel {
    pub fn get_mleader_styles_json(&self) -> String {
        let styles: Vec<&MLeaderStyle> = self.mleader_styles.values().collect();
        serde_json::to_string(&styles).unwrap_or_default()
    }

    pub fn get_current_mleader_style(&self) -> String {
        self.current_mleader_style.clone()
    }
}

impl Kernel {
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn create_mleader_style_cmd(
        &mut self,
        name: &str,
        arrow_size: Option<f64>,
        text_height: Option<f64>,
        text_style_name: Option<String>,
        landing_distance: Option<f64>,
        enable_landing: Option<bool>,
        enable_dogleg: Option<bool>,
        color: Option<String>,
    ) -> CommandResult {
        if self.mleader_styles.contains_key(name) {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("MLeader style '{}' already exists", name)),
                measurement: None,
                warnings: vec![],
            };
        }
        let style = MLeaderStyle {
            name: name.to_string(),
            arrow_size: arrow_size.unwrap_or(2.5),
            text_height: text_height.unwrap_or(2.5),
            text_style_name: text_style_name.unwrap_or_else(|| "Standard".to_string()),
            landing_distance: landing_distance.unwrap_or(8.0),
            enable_landing: enable_landing.unwrap_or(true),
            enable_dogleg: enable_dogleg.unwrap_or(true),
            color,
        };
        self.event_store.push(CadEvent::MLeaderStyleCreated {
            style: style.clone(),
        });
        self.mleader_styles.insert(name.to_string(), style);
        CommandResult {
            success: true,
            created_ids: vec![name.to_string()],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn modify_mleader_style_cmd(
        &mut self,
        name: &str,
        arrow_size: Option<f64>,
        text_height: Option<f64>,
        text_style_name: Option<String>,
        landing_distance: Option<f64>,
        enable_landing: Option<bool>,
        enable_dogleg: Option<bool>,
        color: Option<String>,
    ) -> CommandResult {
        let old = match self.mleader_styles.get(name) {
            Some(s) => s.clone(),
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("MLeader style '{}' not found", name)),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };
        let mut new_style = old.clone();
        if let Some(v) = arrow_size {
            new_style.arrow_size = v;
        }
        if let Some(v) = text_height {
            new_style.text_height = v;
        }
        if let Some(v) = text_style_name {
            new_style.text_style_name = v;
        }
        if let Some(v) = landing_distance {
            new_style.landing_distance = v;
        }
        if let Some(v) = enable_landing {
            new_style.enable_landing = v;
        }
        if let Some(v) = enable_dogleg {
            new_style.enable_dogleg = v;
        }
        if color.is_some() {
            new_style.color = color;
        }
        self.event_store.push(CadEvent::MLeaderStyleModified {
            old_style: old,
            new_style: new_style.clone(),
        });
        self.mleader_styles.insert(name.to_string(), new_style);
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub(crate) fn delete_mleader_style_cmd(&mut self, name: &str) -> CommandResult {
        if name == "Standard" {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Cannot delete the Standard mleader style".to_string()),
                measurement: None,
                warnings: vec![],
            };
        }
        match self.mleader_styles.remove(name) {
            Some(style) => {
                self.event_store
                    .push(CadEvent::MLeaderStyleDeleted { style });
                if self.current_mleader_style == name {
                    self.current_mleader_style = "Standard".to_string();
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
                error: Some(format!("MLeader style '{}' not found", name)),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    pub(crate) fn set_current_mleader_style_cmd(&mut self, name: &str) -> CommandResult {
        if !self.mleader_styles.contains_key(name) {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("MLeader style '{}' not found", name)),
                measurement: None,
                warnings: vec![],
            };
        }
        self.current_mleader_style = name.to_string();
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
    fn standard_mleader_style_exists() {
        let k = Kernel::new();
        assert!(k.mleader_styles.contains_key("Standard"));
        assert_eq!(k.current_mleader_style, "Standard");
    }

    #[test]
    fn standard_mleader_style_defaults() {
        let k = Kernel::new();
        let std = k.mleader_styles.get("Standard").unwrap();
        assert_eq!(std.arrow_size, 2.5);
        assert_eq!(std.text_height, 2.5);
        assert_eq!(std.landing_distance, 8.0);
        assert!(std.enable_landing);
        assert!(std.enable_dogleg);
    }

    #[test]
    fn create_mleader_style() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateMLeaderStyle","name":"Detail","arrow_size":3.5,"landing_distance":12}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        let style = k.mleader_styles.get("Detail").unwrap();
        assert_eq!(style.arrow_size, 3.5);
        assert_eq!(style.landing_distance, 12.0);
    }

    #[test]
    fn create_mleader_style_duplicate() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateMLeaderStyle","name":"Dup"}"#);
        let v = exec(&mut k, r#"{"type":"CreateMLeaderStyle","name":"Dup"}"#);
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("already exists"));
    }

    #[test]
    fn modify_mleader_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateMLeaderStyle","name":"Edit"}"#);
        let v = exec(
            &mut k,
            r#"{"type":"ModifyMLeaderStyle","name":"Edit","arrow_size":5.0,"enable_dogleg":false}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        let style = k.mleader_styles.get("Edit").unwrap();
        assert_eq!(style.arrow_size, 5.0);
        assert!(!style.enable_dogleg);
        assert_eq!(style.text_height, 2.5);
    }

    #[test]
    fn modify_nonexistent_mleader_style() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"ModifyMLeaderStyle","name":"NoSuch"}"#);
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn delete_mleader_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateMLeaderStyle","name":"ToDelete"}"#);
        let v = exec(&mut k, r#"{"type":"DeleteMLeaderStyle","name":"ToDelete"}"#);
        assert!(v["success"].as_bool().unwrap());
        assert!(!k.mleader_styles.contains_key("ToDelete"));
    }

    #[test]
    fn delete_standard_mleader_style_fails() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"DeleteMLeaderStyle","name":"Standard"}"#);
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn set_current_mleader_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateMLeaderStyle","name":"Mech"}"#);
        let v = exec(&mut k, r#"{"type":"SetCurrentMLeaderStyle","name":"Mech"}"#);
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(k.get_current_mleader_style(), "Mech");
    }

    #[test]
    fn delete_current_resets_to_standard() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateMLeaderStyle","name":"Active"}"#);
        exec(
            &mut k,
            r#"{"type":"SetCurrentMLeaderStyle","name":"Active"}"#,
        );
        exec(&mut k, r#"{"type":"DeleteMLeaderStyle","name":"Active"}"#);
        assert_eq!(k.get_current_mleader_style(), "Standard");
    }

    #[test]
    fn new_leader_inherits_current_mleader_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateMLeaderStyle","name":"Mech"}"#);
        exec(&mut k, r#"{"type":"SetCurrentMLeaderStyle","name":"Mech"}"#);
        let r = exec(
            &mut k,
            r#"{"type":"CreateLeader","vertices":[[0,0],[10,10]],"text":"hi","arrow_size":2.5,"text_height":2.5,"layer_id":"layer_0"}"#,
        );
        assert!(r["success"].as_bool().unwrap());
        let id = r["created_ids"][0].as_str().unwrap();
        let entities: serde_json::Value = serde_json::from_str(&k.get_entities_json()).unwrap();
        let ent = entities
            .as_array()
            .unwrap()
            .iter()
            .find(|e| e["id"].as_str() == Some(id))
            .unwrap();
        assert_eq!(
            ent["geometry"]["Leader"]["style_name"].as_str().unwrap(),
            "Mech"
        );
    }
}
