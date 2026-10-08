use crate::commands::CommandResult;
use crate::entity::TableStyle;
use crate::events::CadEvent;
use crate::Kernel;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
impl Kernel {
    pub fn get_table_styles_json(&self) -> String {
        let styles: Vec<&TableStyle> = self.table_styles.values().collect();
        serde_json::to_string(&styles).unwrap_or_default()
    }

    pub fn get_current_table_style(&self) -> String {
        self.current_table_style.clone()
    }
}

impl Kernel {
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn create_table_style_cmd(
        &mut self,
        name: &str,
        text_style_name: Option<String>,
        data_text_height: Option<f64>,
        header_text_height: Option<f64>,
        title_text_height: Option<f64>,
        has_title: Option<bool>,
        has_header: Option<bool>,
        cell_margin: Option<f64>,
        border_color: Option<String>,
        title_fill_color: Option<String>,
        header_fill_color: Option<String>,
    ) -> CommandResult {
        if self.table_styles.contains_key(name) {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Table style '{}' already exists", name)),
                measurement: None,
                warnings: vec![],
            };
        }
        let style = TableStyle {
            name: name.to_string(),
            text_style_name: text_style_name.unwrap_or_else(|| "Standard".to_string()),
            data_text_height: data_text_height.unwrap_or(2.5),
            header_text_height: header_text_height.unwrap_or(4.0),
            title_text_height: title_text_height.unwrap_or(6.0),
            has_title: has_title.unwrap_or(true),
            has_header: has_header.unwrap_or(true),
            cell_margin: cell_margin.unwrap_or(0.5),
            border_color,
            title_fill_color,
            header_fill_color,
        };
        self.event_store.push(CadEvent::TableStyleCreated {
            style: style.clone(),
        });
        self.table_styles.insert(name.to_string(), style);
        CommandResult {
            success: true,
            created_ids: vec![name.to_string()],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn modify_table_style_cmd(
        &mut self,
        name: &str,
        text_style_name: Option<String>,
        data_text_height: Option<f64>,
        header_text_height: Option<f64>,
        title_text_height: Option<f64>,
        has_title: Option<bool>,
        has_header: Option<bool>,
        cell_margin: Option<f64>,
        border_color: Option<String>,
        title_fill_color: Option<String>,
        header_fill_color: Option<String>,
    ) -> CommandResult {
        let old = match self.table_styles.get(name) {
            Some(s) => s.clone(),
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("Table style '{}' not found", name)),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };
        let mut new_style = old.clone();
        if let Some(v) = text_style_name {
            new_style.text_style_name = v;
        }
        if let Some(v) = data_text_height {
            new_style.data_text_height = v;
        }
        if let Some(v) = header_text_height {
            new_style.header_text_height = v;
        }
        if let Some(v) = title_text_height {
            new_style.title_text_height = v;
        }
        if let Some(v) = has_title {
            new_style.has_title = v;
        }
        if let Some(v) = has_header {
            new_style.has_header = v;
        }
        if let Some(v) = cell_margin {
            new_style.cell_margin = v;
        }
        if border_color.is_some() {
            new_style.border_color = border_color;
        }
        if title_fill_color.is_some() {
            new_style.title_fill_color = title_fill_color;
        }
        if header_fill_color.is_some() {
            new_style.header_fill_color = header_fill_color;
        }
        self.event_store.push(CadEvent::TableStyleModified {
            old_style: old,
            new_style: new_style.clone(),
        });
        self.table_styles.insert(name.to_string(), new_style);
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub(crate) fn delete_table_style_cmd(&mut self, name: &str) -> CommandResult {
        if name == "Standard" {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Cannot delete the Standard table style".to_string()),
                measurement: None,
                warnings: vec![],
            };
        }
        match self.table_styles.remove(name) {
            Some(style) => {
                self.event_store.push(CadEvent::TableStyleDeleted { style });
                if self.current_table_style == name {
                    self.current_table_style = "Standard".to_string();
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
                error: Some(format!("Table style '{}' not found", name)),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    pub(crate) fn set_current_table_style_cmd(&mut self, name: &str) -> CommandResult {
        if !self.table_styles.contains_key(name) {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Table style '{}' not found", name)),
                measurement: None,
                warnings: vec![],
            };
        }
        self.current_table_style = name.to_string();
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
    fn standard_table_style_exists() {
        let k = Kernel::new();
        assert!(k.table_styles.contains_key("Standard"));
        assert_eq!(k.current_table_style, "Standard");
    }

    #[test]
    fn standard_table_style_defaults() {
        let k = Kernel::new();
        let std = k.table_styles.get("Standard").unwrap();
        assert_eq!(std.data_text_height, 2.5);
        assert_eq!(std.header_text_height, 4.0);
        assert_eq!(std.title_text_height, 6.0);
        assert_eq!(std.cell_margin, 0.5);
        assert!(std.has_title);
        assert!(std.has_header);
    }

    #[test]
    fn create_table_style() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateTableStyle","name":"Sched","data_text_height":3.0,"has_title":false}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        let style = k.table_styles.get("Sched").unwrap();
        assert_eq!(style.data_text_height, 3.0);
        assert!(!style.has_title);
    }

    #[test]
    fn create_table_style_duplicate() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateTableStyle","name":"Dup"}"#);
        let v = exec(&mut k, r#"{"type":"CreateTableStyle","name":"Dup"}"#);
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn modify_table_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateTableStyle","name":"Edit"}"#);
        let v = exec(
            &mut k,
            r#"{"type":"ModifyTableStyle","name":"Edit","cell_margin":1.5,"has_header":false}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        let style = k.table_styles.get("Edit").unwrap();
        assert_eq!(style.cell_margin, 1.5);
        assert!(!style.has_header);
        assert_eq!(style.data_text_height, 2.5);
    }

    #[test]
    fn delete_table_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateTableStyle","name":"ToDelete"}"#);
        let v = exec(&mut k, r#"{"type":"DeleteTableStyle","name":"ToDelete"}"#);
        assert!(v["success"].as_bool().unwrap());
    }

    #[test]
    fn delete_standard_table_style_fails() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"DeleteTableStyle","name":"Standard"}"#);
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn set_current_table_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateTableStyle","name":"Mech"}"#);
        let v = exec(&mut k, r#"{"type":"SetCurrentTableStyle","name":"Mech"}"#);
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(k.get_current_table_style(), "Mech");
    }

    #[test]
    fn delete_current_resets_to_standard() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateTableStyle","name":"Active"}"#);
        exec(&mut k, r#"{"type":"SetCurrentTableStyle","name":"Active"}"#);
        exec(&mut k, r#"{"type":"DeleteTableStyle","name":"Active"}"#);
        assert_eq!(k.get_current_table_style(), "Standard");
    }
}
