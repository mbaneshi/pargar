use crate::entity::{
    DimStyle, DwgProps, Entity, EntityStyle, GeometryType, Group, MLeaderStyle, NamedUcs,
    NamedView, TableStyle, TextStyle,
};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

#[cfg(target_arch = "wasm32")]
use tsify::Tsify;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub enum Actor {
    User { session_id: String },
    Agent { agent_id: String, model: String },
    System,
}

impl Default for Actor {
    fn default() -> Self {
        Actor::User {
            session_id: "local".to_string(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct EventEnvelope {
    pub seq: u64,
    pub timestamp_ms: u64,
    pub actor: Actor,
    pub schema_version: u16,
    pub prev_hash: String,
    pub payload: CadEvent,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub enum CadEvent {
    EntityCreated {
        entity: Entity,
    },
    EntityDeleted {
        entity: Entity,
    },
    EntityMoved {
        id: String,
        dx: f64,
        dy: f64,
        old_geometry: GeometryType,
    },
    EntityRotated {
        id: String,
        cx: f64,
        cy: f64,
        angle: f64,
        old_geometry: GeometryType,
    },
    EntityScaled {
        id: String,
        cx: f64,
        cy: f64,
        factor: f64,
        old_geometry: GeometryType,
    },
    EntityCopied {
        original_id: String,
        new_entity: Entity,
    },
    EntityModified {
        id: String,
        old_geometry: GeometryType,
        new_geometry: GeometryType,
    },
    EntityStyleChanged {
        id: String,
        old_style: EntityStyle,
        new_style: EntityStyle,
    },
    TextStyleCreated {
        style: TextStyle,
    },
    TextStyleModified {
        old_style: TextStyle,
        new_style: TextStyle,
    },
    TextStyleDeleted {
        style: TextStyle,
    },
    DimStyleCreated {
        style: DimStyle,
    },
    DimStyleModified {
        old_style: DimStyle,
        new_style: DimStyle,
    },
    DimStyleDeleted {
        style: DimStyle,
    },
    MLeaderStyleCreated {
        style: MLeaderStyle,
    },
    MLeaderStyleModified {
        old_style: MLeaderStyle,
        new_style: MLeaderStyle,
    },
    MLeaderStyleDeleted {
        style: MLeaderStyle,
    },
    TableStyleCreated {
        style: TableStyle,
    },
    TableStyleModified {
        old_style: TableStyle,
        new_style: TableStyle,
    },
    TableStyleDeleted {
        style: TableStyle,
    },
    DwgPropsChanged {
        old_props: DwgProps,
        new_props: DwgProps,
    },
    GroupCreated {
        group: Group,
    },
    GroupDeleted {
        group: Group,
    },
    GroupModified {
        old_group: Group,
        new_group: Group,
    },
    NamedUcsCreated {
        ucs: NamedUcs,
    },
    NamedUcsDeleted {
        ucs: NamedUcs,
    },
    NamedUcsModified {
        old_ucs: NamedUcs,
        new_ucs: NamedUcs,
    },
    NamedViewCreated {
        view: NamedView,
    },
    NamedViewDeleted {
        view: NamedView,
    },
    NamedViewModified {
        old_view: NamedView,
        new_view: NamedView,
    },
    CompoundEvent {
        events: Vec<CadEvent>,
    },
}

#[cfg(target_arch = "wasm32")]
fn now_ms() -> u64 {
    js_sys::Date::now() as u64
}

#[cfg(not(target_arch = "wasm32"))]
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn compute_event_hash(envelope: &EventEnvelope) -> String {
    let content = format!(
        "{}:{}:{}:{}",
        envelope.seq,
        envelope.schema_version,
        envelope.prev_hash,
        serde_json::to_string(&envelope.payload).unwrap_or_default()
    );
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:064x}", hasher.finish())
}

pub struct EventStore {
    pub(crate) events: Vec<EventEnvelope>,
    cursor: usize,
    next_seq: u64,
    last_hash: String,
}

impl EventStore {
    pub fn new() -> Self {
        EventStore {
            events: Vec::new(),
            cursor: 0,
            next_seq: 0,
            last_hash: "0".repeat(64),
        }
    }

    pub fn push(&mut self, event: CadEvent) {
        self.push_with_actor(event, Actor::default());
    }

    pub fn push_with_actor(&mut self, event: CadEvent, actor: Actor) {
        self.events.truncate(self.cursor);
        self.last_hash = if self.events.is_empty() {
            "0".repeat(64)
        } else {
            compute_event_hash(&self.events[self.events.len() - 1])
        };
        let envelope = EventEnvelope {
            seq: self.next_seq,
            timestamp_ms: now_ms(),
            actor,
            schema_version: 1,
            prev_hash: self.last_hash.clone(),
            payload: event,
        };
        self.last_hash = compute_event_hash(&envelope);
        self.next_seq += 1;
        self.events.push(envelope);
        self.cursor = self.events.len();
    }

    pub fn can_undo(&self) -> bool {
        self.cursor > 0
    }

    pub fn can_redo(&self) -> bool {
        self.cursor < self.events.len()
    }

    pub fn undo(&mut self) -> Option<&CadEvent> {
        if self.cursor > 0 {
            self.cursor -= 1;
            Some(&self.events[self.cursor].payload)
        } else {
            None
        }
    }

    pub fn redo(&mut self) -> Option<&CadEvent> {
        if self.cursor < self.events.len() {
            let event = &self.events[self.cursor].payload;
            self.cursor += 1;
            Some(event)
        } else {
            None
        }
    }

    pub fn event_count(&self) -> usize {
        self.events.len()
    }

    pub fn undo_depth(&self) -> usize {
        self.cursor
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entity::{Entity, EntityStyle, GeometryType, Point2D};

    fn dummy_event(id: &str) -> CadEvent {
        CadEvent::EntityCreated {
            entity: Entity {
                id: id.to_string(),
                geometry: GeometryType::Point {
                    position: Point2D::new(0.0, 0.0),
                },
                layer_id: "layer_0".to_string(),
                style: EntityStyle::default(),
                draw_order: 0,
            },
        }
    }

    #[test]
    fn new_store_is_empty() {
        let store = EventStore::new();
        assert_eq!(store.event_count(), 0);
        assert!(!store.can_undo());
        assert!(!store.can_redo());
    }

    #[test]
    fn push_increments_count() {
        let mut store = EventStore::new();
        store.push(dummy_event("e1"));
        store.push(dummy_event("e2"));
        store.push(dummy_event("e3"));
        assert_eq!(store.event_count(), 3);
    }

    #[test]
    fn undo_returns_event() {
        let mut store = EventStore::new();
        store.push(dummy_event("e1"));

        assert!(store.can_undo());
        let event = store.undo();
        assert!(event.is_some());
        assert!(!store.can_undo());
        assert!(store.can_redo());
    }

    #[test]
    fn undo_empty_returns_none() {
        let mut store = EventStore::new();
        assert!(store.undo().is_none());
    }

    #[test]
    fn redo_returns_event() {
        let mut store = EventStore::new();
        store.push(dummy_event("e1"));
        store.undo();

        assert!(store.can_redo());
        let event = store.redo();
        assert!(event.is_some());
        assert!(!store.can_redo());
        assert!(store.can_undo());
    }

    #[test]
    fn redo_at_top_returns_none() {
        let mut store = EventStore::new();
        store.push(dummy_event("e1"));
        assert!(store.redo().is_none());
    }

    #[test]
    fn push_after_undo_truncates_future() {
        let mut store = EventStore::new();
        store.push(dummy_event("a"));
        store.push(dummy_event("b"));

        store.undo(); // undo B, cursor at 1
        store.push(dummy_event("c")); // replaces B with C

        assert_eq!(store.event_count(), 2);
        assert!(!store.can_redo());
        assert!(store.can_undo());
    }

    #[test]
    fn push_with_actor_works() {
        let mut store = EventStore::new();
        let actor = Actor::Agent {
            agent_id: "agent-1".to_string(),
            model: "test".to_string(),
        };
        store.push_with_actor(dummy_event("e1"), actor);

        assert_eq!(store.event_count(), 1);
        assert!(store.can_undo());

        let event = store.undo();
        assert!(event.is_some());
        assert!(!store.can_undo());
    }

    #[test]
    fn events_are_hash_chained() {
        let mut store = EventStore::new();
        store.push(dummy_event("e1"));
        store.push(dummy_event("e2"));
        store.push(dummy_event("e3"));

        let genesis = "0".repeat(64);
        assert_eq!(store.events[0].prev_hash, genesis);

        let hash_of_e1 = compute_event_hash(&store.events[0]);
        assert_eq!(store.events[1].prev_hash, hash_of_e1);

        let hash_of_e2 = compute_event_hash(&store.events[1]);
        assert_eq!(store.events[2].prev_hash, hash_of_e2);

        assert_ne!(store.events[1].prev_hash, genesis);
        assert_ne!(store.events[2].prev_hash, genesis);
        assert_ne!(store.events[1].prev_hash, store.events[2].prev_hash);
    }

    #[test]
    fn hash_chain_is_deterministic() {
        let mut store1 = EventStore::new();
        let mut store2 = EventStore::new();

        store1.push(dummy_event("e1"));
        store2.push(dummy_event("e1"));

        assert_eq!(
            compute_event_hash(&store1.events[0]),
            compute_event_hash(&store2.events[0])
        );

        store1.push(dummy_event("e2"));
        store2.push(dummy_event("e2"));

        assert_eq!(store1.events[1].prev_hash, store2.events[1].prev_hash);
    }
}
