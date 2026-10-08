use crate::commands::CommandResult;
use crate::entity::DimStyle;
use crate::events::CadEvent;
use crate::Kernel;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
impl Kernel {
    pub fn get_dim_styles_json(&self) -> String {
        let styles: Vec<&DimStyle> = self.dim_styles.values().collect();
        serde_json::to_string(&styles).unwrap_or_default()
    }

    pub fn get_current_dim_style(&self) -> String {
        self.current_dim_style.clone()
    }
}

impl Kernel {
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn create_dim_style_cmd(
        &mut self,
        name: &str,
        dimscale: Option<f64>,
        dimtxt: Option<f64>,
        dimasz: Option<f64>,
        dimexo: Option<f64>,
        dimexe: Option<f64>,
        dimgap: Option<f64>,
        dimtad: Option<i32>,
        dimclrt: Option<String>,
        dimclrd: Option<String>,
        dimclre: Option<String>,
        dimtxsty: Option<String>,
    ) -> CommandResult {
        if self.dim_styles.contains_key(name) {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Dim style '{}' already exists", name)),
                measurement: None,
                warnings: vec![],
            };
        }
        let style = DimStyle {
            name: name.to_string(),
            dimscale: dimscale.unwrap_or(1.0),
            dimtxt: dimtxt.unwrap_or(2.5),
            dimasz: dimasz.unwrap_or(2.5),
            dimexo: dimexo.unwrap_or(0.625),
            dimexe: dimexe.unwrap_or(1.25),
            dimgap: dimgap.unwrap_or(0.625),
            dimtad: dimtad.unwrap_or(1),
            dimclrt,
            dimclrd,
            dimclre,
            dimtxsty: dimtxsty.unwrap_or_else(|| "Standard".to_string()),
        };
        self.event_store.push(CadEvent::DimStyleCreated {
            style: style.clone(),
        });
        self.dim_styles.insert(name.to_string(), style);
        CommandResult {
            success: true,
            created_ids: vec![name.to_string()],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn modify_dim_style_cmd(
        &mut self,
        name: &str,
        dimscale: Option<f64>,
        dimtxt: Option<f64>,
        dimasz: Option<f64>,
        dimexo: Option<f64>,
        dimexe: Option<f64>,
        dimgap: Option<f64>,
        dimtad: Option<i32>,
        dimclrt: Option<String>,
        dimclrd: Option<String>,
        dimclre: Option<String>,
        dimtxsty: Option<String>,
    ) -> CommandResult {
        let old = match self.dim_styles.get(name) {
            Some(s) => s.clone(),
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("Dim style '{}' not found", name)),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };
        let mut new_style = old.clone();
        if let Some(v) = dimscale {
            new_style.dimscale = v;
        }
        if let Some(v) = dimtxt {
            new_style.dimtxt = v;
        }
        if let Some(v) = dimasz {
            new_style.dimasz = v;
        }
        if let Some(v) = dimexo {
            new_style.dimexo = v;
        }
        if let Some(v) = dimexe {
            new_style.dimexe = v;
        }
        if let Some(v) = dimgap {
            new_style.dimgap = v;
        }
        if let Some(v) = dimtad {
            new_style.dimtad = v;
        }
        if dimclrt.is_some() {
            new_style.dimclrt = dimclrt;
        }
        if dimclrd.is_some() {
            new_style.dimclrd = dimclrd;
        }
        if dimclre.is_some() {
            new_style.dimclre = dimclre;
        }
        if let Some(v) = dimtxsty {
            new_style.dimtxsty = v;
        }
        self.event_store.push(CadEvent::DimStyleModified {
            old_style: old,
            new_style: new_style.clone(),
        });
        self.dim_styles.insert(name.to_string(), new_style);
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub(crate) fn delete_dim_style_cmd(&mut self, name: &str) -> CommandResult {
        if name == "Standard" {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Cannot delete the Standard dim style".to_string()),
                measurement: None,
                warnings: vec![],
            };
        }
        match self.dim_styles.remove(name) {
            Some(style) => {
                self.event_store.push(CadEvent::DimStyleDeleted { style });
                if self.current_dim_style == name {
                    self.current_dim_style = "Standard".to_string();
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
                error: Some(format!("Dim style '{}' not found", name)),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    pub(crate) fn set_current_dim_style_cmd(&mut self, name: &str) -> CommandResult {
        if !self.dim_styles.contains_key(name) {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Dim style '{}' not found", name)),
                measurement: None,
                warnings: vec![],
            };
        }
        self.current_dim_style = name.to_string();
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
    fn standard_dim_style_exists() {
        let k = Kernel::new();
        assert!(k.dim_styles.contains_key("Standard"));
        assert_eq!(k.current_dim_style, "Standard");
    }

    #[test]
    fn standard_dim_style_defaults() {
        let k = Kernel::new();
        let std = k.dim_styles.get("Standard").unwrap();
        assert_eq!(std.dimscale, 1.0);
        assert_eq!(std.dimtxt, 2.5);
        assert_eq!(std.dimasz, 2.5);
        assert_eq!(std.dimtad, 1);
        assert_eq!(std.dimtxsty, "Standard");
    }

    #[test]
    fn create_dim_style() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateDimStyle","name":"Architectural","dimscale":48.0,"dimtxt":3.5}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"][0].as_str().unwrap(), "Architectural");
        let style = k.dim_styles.get("Architectural").unwrap();
        assert_eq!(style.dimscale, 48.0);
        assert_eq!(style.dimtxt, 3.5);
        assert_eq!(style.dimasz, 2.5); // default
    }

    #[test]
    fn create_dim_style_with_all_fields() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r##"{"type":"CreateDimStyle","name":"Full","dimscale":2.0,"dimtxt":4.0,"dimasz":3.0,"dimexo":1.0,"dimexe":2.0,"dimgap":0.5,"dimtad":0,"dimclrt":"#ff0000","dimclrd":"#00ff00","dimclre":"#0000ff","dimtxsty":"Heading"}"##,
        );
        assert!(v["success"].as_bool().unwrap());
        let style = k.dim_styles.get("Full").unwrap();
        assert_eq!(style.dimscale, 2.0);
        assert_eq!(style.dimtxt, 4.0);
        assert_eq!(style.dimasz, 3.0);
        assert_eq!(style.dimtad, 0);
        assert_eq!(style.dimclrt.as_deref(), Some("#ff0000"));
        assert_eq!(style.dimclrd.as_deref(), Some("#00ff00"));
        assert_eq!(style.dimclre.as_deref(), Some("#0000ff"));
        assert_eq!(style.dimtxsty, "Heading");
    }

    #[test]
    fn create_dim_style_duplicate() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateDimStyle","name":"Dup"}"#);
        let v = exec(&mut k, r#"{"type":"CreateDimStyle","name":"Dup"}"#);
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("already exists"));
    }

    #[test]
    fn create_dim_style_named_standard_fails() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"CreateDimStyle","name":"Standard"}"#);
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("already exists"));
    }

    #[test]
    fn modify_dim_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateDimStyle","name":"Editable"}"#);
        let v = exec(
            &mut k,
            r#"{"type":"ModifyDimStyle","name":"Editable","dimscale":10.0,"dimtxt":7.0}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        let style = k.dim_styles.get("Editable").unwrap();
        assert_eq!(style.dimscale, 10.0);
        assert_eq!(style.dimtxt, 7.0);
        // Untouched field stays at default
        assert_eq!(style.dimasz, 2.5);
    }

    #[test]
    fn modify_nonexistent_dim_style() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"ModifyDimStyle","name":"NoSuch","dimscale":2.0}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("not found"));
    }

    #[test]
    fn modify_standard_dim_style() {
        // Standard CAN be modified (matches AutoCAD behavior — DIMSTYLE Standard
        // may be tweaked, just not deleted).
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"ModifyDimStyle","name":"Standard","dimscale":2.0}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(k.dim_styles.get("Standard").unwrap().dimscale, 2.0);
    }

    #[test]
    fn delete_dim_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateDimStyle","name":"ToDelete"}"#);
        let v = exec(&mut k, r#"{"type":"DeleteDimStyle","name":"ToDelete"}"#);
        assert!(v["success"].as_bool().unwrap());
        assert!(!k.dim_styles.contains_key("ToDelete"));
    }

    #[test]
    fn delete_standard_dim_style_fails() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"DeleteDimStyle","name":"Standard"}"#);
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("Cannot delete"));
    }

    #[test]
    fn delete_nonexistent_dim_style() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"DeleteDimStyle","name":"Ghost"}"#);
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("not found"));
    }

    #[test]
    fn set_current_dim_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateDimStyle","name":"Mech"}"#);
        let v = exec(&mut k, r#"{"type":"SetCurrentDimStyle","name":"Mech"}"#);
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(k.get_current_dim_style(), "Mech");
    }

    #[test]
    fn set_current_dim_style_nonexistent() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"SetCurrentDimStyle","name":"NoSuch"}"#);
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("not found"));
    }

    #[test]
    fn delete_current_style_resets_to_standard() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateDimStyle","name":"Active"}"#);
        exec(&mut k, r#"{"type":"SetCurrentDimStyle","name":"Active"}"#);
        assert_eq!(k.get_current_dim_style(), "Active");
        exec(&mut k, r#"{"type":"DeleteDimStyle","name":"Active"}"#);
        assert_eq!(k.get_current_dim_style(), "Standard");
    }

    #[test]
    fn get_dim_styles_includes_standard() {
        let k = Kernel::new();
        let styles = k.get_dim_styles_json();
        assert!(styles.contains("Standard"));
    }

    #[test]
    fn dim_style_event_logged_on_create() {
        let mut k = Kernel::new();
        let before = k.event_store.event_count();
        exec(&mut k, r#"{"type":"CreateDimStyle","name":"Logged"}"#);
        assert_eq!(k.event_store.event_count(), before + 1);
    }

    #[test]
    fn dim_style_event_logged_on_modify() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateDimStyle","name":"Mod"}"#);
        let before = k.event_store.event_count();
        exec(
            &mut k,
            r#"{"type":"ModifyDimStyle","name":"Mod","dimscale":5.0}"#,
        );
        assert_eq!(k.event_store.event_count(), before + 1);
    }

    #[test]
    fn dim_style_event_logged_on_delete() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateDimStyle","name":"Del"}"#);
        let before = k.event_store.event_count();
        exec(&mut k, r#"{"type":"DeleteDimStyle","name":"Del"}"#);
        assert_eq!(k.event_store.event_count(), before + 1);
    }

    // --- Auto-assignment of current_dim_style on dimension creation ---

    #[test]
    fn new_dimension_inherits_current_dim_style() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateDimStyle","name":"Mech","dimscale":2.0}"#,
        );
        exec(&mut k, r#"{"type":"SetCurrentDimStyle","name":"Mech"}"#);
        let r = exec(
            &mut k,
            r#"{"type":"CreateDimension","x1":0,"y1":0,"x2":10,"y2":0,"offset":5,"layer_id":"layer_0"}"#,
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
            ent["geometry"]["Dimension"]["style_name"].as_str().unwrap(),
            "Mech"
        );
    }

    #[test]
    fn new_dimension_inherits_standard_when_no_style_set() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateDimension","x1":0,"y1":0,"x2":10,"y2":0,"offset":5,"layer_id":"layer_0"}"#,
        );
        let id = r["created_ids"][0].as_str().unwrap();
        let entities: serde_json::Value = serde_json::from_str(&k.get_entities_json()).unwrap();
        let ent = entities
            .as_array()
            .unwrap()
            .iter()
            .find(|e| e["id"].as_str() == Some(id))
            .unwrap();
        assert_eq!(
            ent["geometry"]["Dimension"]["style_name"].as_str().unwrap(),
            "Standard"
        );
    }

    #[test]
    fn aligned_dimension_inherits_current_dim_style() {
        let mut k = Kernel::new();
        exec(&mut k, r#"{"type":"CreateDimStyle","name":"Arch"}"#);
        exec(&mut k, r#"{"type":"SetCurrentDimStyle","name":"Arch"}"#);
        let r = exec(
            &mut k,
            r#"{"type":"CreateAlignedDimension","x1":0,"y1":0,"x2":10,"y2":10,"offset":5,"layer_id":"layer_0"}"#,
        );
        let id = r["created_ids"][0].as_str().unwrap();
        let entities: serde_json::Value = serde_json::from_str(&k.get_entities_json()).unwrap();
        let ent = entities
            .as_array()
            .unwrap()
            .iter()
            .find(|e| e["id"].as_str() == Some(id))
            .unwrap();
        assert_eq!(
            ent["geometry"]["AlignedDimension"]["style_name"]
                .as_str()
                .unwrap(),
            "Arch"
        );
    }
}
