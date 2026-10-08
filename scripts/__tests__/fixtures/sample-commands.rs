use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum Command {
    // Drawing
    CreatePoint {
        x: f64,
        y: f64,
        layer_id: String,
    },
    CreateLine {
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        layer_id: String,
    },
    // Editing
    DeleteEntity {
        id: String,
    },
    MoveEntity {
        id: String,
        dx: f64,
        dy: f64,
    },
    // System commands
    Undo,
    Redo,
    AnalyzeDof,
}

impl Command {
    pub fn referenced_entity_ids(&self) -> Vec<String> {
        vec![]
    }
}
