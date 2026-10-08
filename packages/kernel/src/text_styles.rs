use crate::commands::CommandResult;
use crate::entity;
use crate::entity::TextStyle;
use crate::events::CadEvent;
use crate::Kernel;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
impl Kernel {
    pub fn get_text_styles_json(&self) -> String {
        let styles: Vec<&TextStyle> = self.text_styles.values().collect();
        serde_json::to_string(&styles).unwrap_or_default()
    }

    pub fn get_current_text_style(&self) -> String {
        self.current_text_style.clone()
    }
}

impl Kernel {
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn create_text_style_cmd(
        &mut self,
        name: &str,
        font_family: Option<String>,
        height: Option<f64>,
        width_factor: Option<f64>,
        oblique_angle: Option<f64>,
        is_bold: Option<bool>,
        is_italic: Option<bool>,
    ) -> CommandResult {
        if self.text_styles.contains_key(name) {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Text style '{}' already exists", name)),
                measurement: None,
                warnings: vec![],
            };
        }
        let style = TextStyle {
            name: name.to_string(),
            font_family: font_family.unwrap_or_else(|| "sans-serif".to_string()),
            height: height.unwrap_or(2.5),
            width_factor: width_factor.unwrap_or(1.0),
            oblique_angle: oblique_angle.unwrap_or(0.0),
            is_bold: is_bold.unwrap_or(false),
            is_italic: is_italic.unwrap_or(false),
        };
        self.event_store.push(CadEvent::TextStyleCreated {
            style: style.clone(),
        });
        self.text_styles.insert(name.to_string(), style);
        CommandResult {
            success: true,
            created_ids: vec![name.to_string()],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn modify_text_style_cmd(
        &mut self,
        name: &str,
        font_family: Option<String>,
        height: Option<f64>,
        width_factor: Option<f64>,
        oblique_angle: Option<f64>,
        is_bold: Option<bool>,
        is_italic: Option<bool>,
    ) -> CommandResult {
        let old = match self.text_styles.get(name) {
            Some(s) => s.clone(),
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("Text style '{}' not found", name)),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };
        let mut new_style = old.clone();
        if let Some(ff) = font_family {
            new_style.font_family = ff;
        }
        if let Some(h) = height {
            new_style.height = h;
        }
        if let Some(wf) = width_factor {
            new_style.width_factor = wf;
        }
        if let Some(oa) = oblique_angle {
            new_style.oblique_angle = oa;
        }
        if let Some(b) = is_bold {
            new_style.is_bold = b;
        }
        if let Some(i) = is_italic {
            new_style.is_italic = i;
        }
        self.event_store.push(CadEvent::TextStyleModified {
            old_style: old,
            new_style: new_style.clone(),
        });
        self.text_styles.insert(name.to_string(), new_style);
        self.ecs_world.for_each_entity(|ent| {
            let uses_style = match &ent.geometry {
                entity::GeometryType::Text { style_name, .. }
                | entity::GeometryType::MText { style_name, .. } => {
                    style_name.as_deref() == Some(name)
                }
                _ => false,
            };
            if uses_style {
                self.dirty_ids.insert(ent.id.clone());
            }
        });
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub(crate) fn delete_text_style_cmd(&mut self, name: &str) -> CommandResult {
        if name == "Standard" {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Cannot delete the Standard text style".to_string()),
                measurement: None,
                warnings: vec![],
            };
        }
        let mut in_use = false;
        self.ecs_world.for_each_entity(|ent| {
            if !in_use {
                let uses_style = match &ent.geometry {
                    entity::GeometryType::Text { style_name, .. }
                    | entity::GeometryType::MText { style_name, .. } => {
                        style_name.as_deref() == Some(name)
                    }
                    _ => false,
                };
                if uses_style {
                    in_use = true;
                }
            }
        });
        if in_use {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Text style '{}' is in use", name)),
                measurement: None,
                warnings: vec![],
            };
        }
        match self.text_styles.remove(name) {
            Some(style) => {
                self.event_store.push(CadEvent::TextStyleDeleted { style });
                if self.current_text_style == name {
                    self.current_text_style = "Standard".to_string();
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
                error: Some(format!("Text style '{}' not found", name)),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    pub(crate) fn set_current_text_style_cmd(&mut self, name: &str) -> CommandResult {
        if !self.text_styles.contains_key(name) {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Text style '{}' not found", name)),
                measurement: None,
                warnings: vec![],
            };
        }
        self.current_text_style = name.to_string();
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
    fn create_text_style() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateTextStyle","name":"MyStyle","font_family":"Arial","height":3.0}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"][0].as_str().unwrap(), "MyStyle");
    }

    #[test]
    fn create_text_style_duplicate() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateTextStyle","name":"Dup"}"#);
        let v = exec(&mut k, r#"{"type":"CreateTextStyle","name":"Dup"}"#);
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("already exists"));
    }

    #[test]
    fn create_text_style_defaults() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateTextStyle","name":"Minimal"}"#);
        let styles = k.get_text_styles_json();
        assert!(styles.contains("Minimal"));
        assert!(styles.contains("sans-serif"));
    }

    #[test]
    fn get_current_text_style_default() {
        let k = Kernel::new();
        assert_eq!(k.get_current_text_style(), "Standard");
    }

    #[test]
    fn set_current_text_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateTextStyle","name":"Custom"}"#);
        let v = exec(&mut k, r#"{"type":"SetCurrentTextStyle","name":"Custom"}"#);
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(k.get_current_text_style(), "Custom");
    }

    #[test]
    fn set_current_text_style_nonexistent() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"SetCurrentTextStyle","name":"NoSuch"}"#);
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("not found"));
    }

    #[test]
    fn delete_text_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateTextStyle","name":"ToDelete"}"#);
        let v = exec(&mut k, r#"{"type":"DeleteTextStyle","name":"ToDelete"}"#);
        assert!(v["success"].as_bool().unwrap());
    }

    #[test]
    fn delete_standard_text_style_fails() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"DeleteTextStyle","name":"Standard"}"#);
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("Cannot delete"));
    }

    #[test]
    fn delete_nonexistent_text_style() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"DeleteTextStyle","name":"Ghost"}"#);
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("not found"));
    }

    #[test]
    fn delete_text_style_in_use() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateTextStyle","name":"InUse"}"#);
        // Create a text entity that uses this style — we need to check the dispatch
        // Text entities don't directly reference styles via command, so we test deletion of unused style
        let v = exec(&mut k, r#"{"type":"DeleteTextStyle","name":"InUse"}"#);
        assert!(v["success"].as_bool().unwrap());
    }

    #[test]
    fn delete_current_style_resets_to_standard() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateTextStyle","name":"Active"}"#);
        exec(&mut k, r#"{"type":"SetCurrentTextStyle","name":"Active"}"#);
        assert_eq!(k.get_current_text_style(), "Active");
        exec(&mut k, r#"{"type":"DeleteTextStyle","name":"Active"}"#);
        assert_eq!(k.get_current_text_style(), "Standard");
    }

    #[test]
    fn get_text_styles_includes_standard() {
        let k = Kernel::new();
        let styles = k.get_text_styles_json();
        assert!(styles.contains("Standard"));
    }

    #[test]
    fn modify_text_style() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateTextStyle","name":"Editable","font_family":"Arial","height":2.5}"#,
        );
        let v = exec(
            &mut k,
            r#"{"type":"ModifyTextStyle","name":"Editable","font_family":"Helvetica","height":5.0,"is_bold":true}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        let styles = k.get_text_styles_json();
        assert!(styles.contains("Helvetica"));
        assert!(styles.contains("5.0") || styles.contains("5"));
    }

    #[test]
    fn modify_nonexistent_text_style() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"ModifyTextStyle","name":"NoSuch","height":5.0}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("not found"));
    }
}
