use crate::commands::CommandResult;
use crate::events::CadEvent;
use crate::Kernel;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
impl Kernel {
    pub fn get_dwg_props_json(&self) -> String {
        serde_json::to_string(&self.dwg_props).unwrap_or_default()
    }
}

impl Kernel {
    /// Apply a partial update to the drawing's DWGPROPS metadata. Any field
    /// passed as None is preserved at its current value.
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn set_dwg_props_cmd(
        &mut self,
        title: Option<String>,
        subject: Option<String>,
        author: Option<String>,
        keywords: Option<String>,
        comments: Option<String>,
        hyperlink_base: Option<String>,
        last_saved_by: Option<String>,
    ) -> CommandResult {
        let old = self.dwg_props.clone();
        let mut new_props = old.clone();
        if let Some(v) = title {
            new_props.title = v;
        }
        if let Some(v) = subject {
            new_props.subject = v;
        }
        if let Some(v) = author {
            new_props.author = v;
        }
        if let Some(v) = keywords {
            new_props.keywords = v;
        }
        if let Some(v) = comments {
            new_props.comments = v;
        }
        if let Some(v) = hyperlink_base {
            new_props.hyperlink_base = v;
        }
        if let Some(v) = last_saved_by {
            new_props.last_saved_by = v;
        }
        self.event_store.push(CadEvent::DwgPropsChanged {
            old_props: old,
            new_props: new_props.clone(),
        });
        self.dwg_props = new_props;
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
    fn dwg_props_default_empty() {
        let k = Kernel::new();
        assert_eq!(k.dwg_props.title, "");
        assert_eq!(k.dwg_props.author, "");
    }

    #[test]
    fn set_dwg_props_basic() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SetDwgProps","title":"Site Plan","author":"Mehdi"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(k.dwg_props.title, "Site Plan");
        assert_eq!(k.dwg_props.author, "Mehdi");
        assert_eq!(k.dwg_props.subject, "");
    }

    #[test]
    fn set_dwg_props_partial_preserves_other_fields() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SetDwgProps","title":"Initial","author":"A"}"#,
        );
        exec(&mut k, r#"{"type":"SetDwgProps","subject":"Foundations"}"#);
        assert_eq!(k.dwg_props.title, "Initial");
        assert_eq!(k.dwg_props.author, "A");
        assert_eq!(k.dwg_props.subject, "Foundations");
    }

    #[test]
    fn set_dwg_props_all_fields() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SetDwgProps","title":"T","subject":"S","author":"A","keywords":"K","comments":"C","hyperlink_base":"http://example.com","last_saved_by":"L"}"#,
        );
        assert_eq!(k.dwg_props.title, "T");
        assert_eq!(k.dwg_props.subject, "S");
        assert_eq!(k.dwg_props.author, "A");
        assert_eq!(k.dwg_props.keywords, "K");
        assert_eq!(k.dwg_props.comments, "C");
        assert_eq!(k.dwg_props.hyperlink_base, "http://example.com");
        assert_eq!(k.dwg_props.last_saved_by, "L");
    }

    #[test]
    fn set_dwg_props_logs_event() {
        let mut k = Kernel::new();
        let before = k.event_store.event_count();
        exec(&mut k, r#"{"type":"SetDwgProps","title":"X"}"#);
        assert_eq!(k.event_store.event_count(), before + 1);
    }

    #[test]
    fn get_dwg_props_json_roundtrips() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SetDwgProps","title":"Round","author":"Trip"}"#,
        );
        let json = k.get_dwg_props_json();
        assert!(json.contains("Round"));
        assert!(json.contains("Trip"));
    }
}
