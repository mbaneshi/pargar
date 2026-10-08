use crate::commands::CommandResult;
use crate::entity::Group;
use crate::events::CadEvent;
use crate::Kernel;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
impl Kernel {
    pub fn get_groups_json(&self) -> String {
        let groups: Vec<&Group> = self.groups.values().collect();
        serde_json::to_string(&groups).unwrap_or_default()
    }
}

impl Kernel {
    pub(crate) fn create_group_cmd(
        &mut self,
        name: Option<String>,
        entity_ids: Vec<String>,
        selectable: Option<bool>,
    ) -> CommandResult {
        let (final_name, anonymous) = match name {
            Some(n) if !n.is_empty() => {
                if self.groups.contains_key(&n) {
                    return CommandResult {
                        success: false,
                        created_ids: vec![],
                        error: Some(format!("Group '{}' already exists", n)),
                        measurement: None,
                        warnings: vec![],
                    };
                }
                (n, false)
            }
            _ => {
                let n = format!("*AnonymousG{}", self.next_anon_group);
                self.next_anon_group += 1;
                (n, true)
            }
        };

        let group = Group {
            name: final_name.clone(),
            anonymous,
            selectable: selectable.unwrap_or(true),
            entity_ids,
        };
        self.event_store.push(CadEvent::GroupCreated {
            group: group.clone(),
        });
        self.groups.insert(final_name.clone(), group);
        CommandResult {
            success: true,
            created_ids: vec![final_name],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub(crate) fn delete_group_cmd(&mut self, name: &str) -> CommandResult {
        match self.groups.remove(name) {
            Some(group) => {
                self.event_store.push(CadEvent::GroupDeleted { group });
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
                error: Some(format!("Group '{}' not found", name)),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    pub(crate) fn rename_group_cmd(&mut self, old_name: &str, new_name: &str) -> CommandResult {
        if self.groups.contains_key(new_name) {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Group '{}' already exists", new_name)),
                measurement: None,
                warnings: vec![],
            };
        }
        let old = match self.groups.remove(old_name) {
            Some(g) => g,
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("Group '{}' not found", old_name)),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };
        let mut new_group = old.clone();
        new_group.name = new_name.to_string();
        new_group.anonymous = false;
        self.event_store.push(CadEvent::GroupModified {
            old_group: old,
            new_group: new_group.clone(),
        });
        self.groups.insert(new_name.to_string(), new_group);
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub(crate) fn add_to_group_cmd(
        &mut self,
        name: &str,
        entity_ids: Vec<String>,
    ) -> CommandResult {
        let old = match self.groups.get(name) {
            Some(g) => g.clone(),
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("Group '{}' not found", name)),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };
        let mut new_group = old.clone();
        for id in entity_ids {
            if !new_group.entity_ids.contains(&id) {
                new_group.entity_ids.push(id);
            }
        }
        self.event_store.push(CadEvent::GroupModified {
            old_group: old,
            new_group: new_group.clone(),
        });
        self.groups.insert(name.to_string(), new_group);
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub(crate) fn remove_from_group_cmd(
        &mut self,
        name: &str,
        entity_ids: Vec<String>,
    ) -> CommandResult {
        let old = match self.groups.get(name) {
            Some(g) => g.clone(),
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("Group '{}' not found", name)),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };
        let mut new_group = old.clone();
        new_group.entity_ids.retain(|id| !entity_ids.contains(id));
        self.event_store.push(CadEvent::GroupModified {
            old_group: old,
            new_group: new_group.clone(),
        });
        self.groups.insert(name.to_string(), new_group);
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub(crate) fn set_group_selectable_cmd(
        &mut self,
        name: &str,
        selectable: bool,
    ) -> CommandResult {
        let old = match self.groups.get(name) {
            Some(g) => g.clone(),
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("Group '{}' not found", name)),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };
        let mut new_group = old.clone();
        new_group.selectable = selectable;
        self.event_store.push(CadEvent::GroupModified {
            old_group: old,
            new_group: new_group.clone(),
        });
        self.groups.insert(name.to_string(), new_group);
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
    fn no_groups_initially() {
        let k = Kernel::new();
        assert!(k.groups.is_empty());
    }

    #[test]
    fn create_named_group() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateGroup","name":"Walls","entity_ids":["a","b","c"]}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        let g = k.groups.get("Walls").unwrap();
        assert_eq!(g.entity_ids.len(), 3);
        assert!(!g.anonymous);
        assert!(g.selectable);
    }

    #[test]
    fn create_anonymous_group() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"CreateGroup","entity_ids":["a"]}"#);
        assert!(v["success"].as_bool().unwrap());
        let name = v["created_ids"][0].as_str().unwrap();
        assert!(name.starts_with("*Anonymous"));
        let g = k.groups.get(name).unwrap();
        assert!(g.anonymous);
    }

    #[test]
    fn create_group_duplicate_name_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateGroup","name":"X","entity_ids":["a"]}"#,
        );
        let v = exec(
            &mut k,
            r#"{"type":"CreateGroup","name":"X","entity_ids":["b"]}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn delete_group() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateGroup","name":"X","entity_ids":["a"]}"#,
        );
        let v = exec(&mut k, r#"{"type":"DeleteGroup","name":"X"}"#);
        assert!(v["success"].as_bool().unwrap());
        assert!(!k.groups.contains_key("X"));
    }

    #[test]
    fn delete_nonexistent_group() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"DeleteGroup","name":"Ghost"}"#);
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn rename_group() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateGroup","name":"Old","entity_ids":["a"]}"#,
        );
        let v = exec(
            &mut k,
            r#"{"type":"RenameGroup","old_name":"Old","new_name":"New"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert!(!k.groups.contains_key("Old"));
        assert!(k.groups.contains_key("New"));
        assert!(!k.groups.get("New").unwrap().anonymous);
    }

    #[test]
    fn add_to_group_dedup() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateGroup","name":"X","entity_ids":["a"]}"#,
        );
        exec(
            &mut k,
            r#"{"type":"AddToGroup","name":"X","entity_ids":["a","b","c"]}"#,
        );
        let g = k.groups.get("X").unwrap();
        assert_eq!(g.entity_ids.len(), 3);
    }

    #[test]
    fn remove_from_group() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateGroup","name":"X","entity_ids":["a","b","c"]}"#,
        );
        exec(
            &mut k,
            r#"{"type":"RemoveFromGroup","name":"X","entity_ids":["b"]}"#,
        );
        let g = k.groups.get("X").unwrap();
        assert_eq!(g.entity_ids.len(), 2);
        assert!(!g.entity_ids.contains(&"b".to_string()));
    }

    #[test]
    fn set_group_selectable() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateGroup","name":"X","entity_ids":["a"]}"#,
        );
        exec(
            &mut k,
            r#"{"type":"SetGroupSelectable","name":"X","selectable":false}"#,
        );
        assert!(!k.groups.get("X").unwrap().selectable);
    }
}
