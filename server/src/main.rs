use nexus_kernel::Kernel;
use serde::{Deserialize, Serialize};
use std::io::{self, BufRead, Write};

#[derive(Deserialize)]
struct Request {
    tool: String,
    #[serde(default)]
    args: serde_json::Value,
}

#[derive(Serialize)]
struct Response {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn handle_request(kernel: &mut Kernel, req: Request) -> Response {
    match req.tool.as_str() {
        "create_line" => {
            let x1 = req.args["x1"].as_f64().unwrap_or(0.0);
            let y1 = req.args["y1"].as_f64().unwrap_or(0.0);
            let x2 = req.args["x2"].as_f64().unwrap_or(0.0);
            let y2 = req.args["y2"].as_f64().unwrap_or(0.0);
            let layer_id = req.args["layer_id"].as_str().unwrap_or("layer_0");

            let cmd = serde_json::json!({
                "type": "CreateLine",
                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                "layer_id": layer_id
            });
            let result_json = kernel.execute_command(&cmd.to_string());
            let result: serde_json::Value =
                serde_json::from_str(&result_json).unwrap_or(serde_json::Value::Null);
            let success = result["success"].as_bool().unwrap_or(false);
            Response {
                success,
                result: Some(result),
                error: None,
            }
        }
        "create_circle" => {
            let cx = req.args["cx"].as_f64().unwrap_or(0.0);
            let cy = req.args["cy"].as_f64().unwrap_or(0.0);
            let radius = req.args["radius"].as_f64().unwrap_or(1.0);
            let layer_id = req.args["layer_id"].as_str().unwrap_or("layer_0");

            let cmd = serde_json::json!({
                "type": "CreateCircle",
                "cx": cx, "cy": cy, "radius": radius,
                "layer_id": layer_id
            });
            let result_json = kernel.execute_command(&cmd.to_string());
            let result: serde_json::Value =
                serde_json::from_str(&result_json).unwrap_or(serde_json::Value::Null);
            let success = result["success"].as_bool().unwrap_or(false);
            Response {
                success,
                result: Some(result),
                error: None,
            }
        }
        "get_entities" => {
            let entities_json = kernel.get_entities_json();
            let entities: serde_json::Value =
                serde_json::from_str(&entities_json).unwrap_or(serde_json::Value::Array(vec![]));
            Response {
                success: true,
                result: Some(entities),
                error: None,
            }
        }
        "undo" => {
            let cmd = serde_json::json!({ "type": "Undo" });
            let result_json = kernel.execute_command(&cmd.to_string());
            let result: serde_json::Value =
                serde_json::from_str(&result_json).unwrap_or(serde_json::Value::Null);
            let success = result["success"].as_bool().unwrap_or(false);
            Response {
                success,
                result: Some(result),
                error: None,
            }
        }
        "get_state" => {
            let state = serde_json::json!({
                "entity_count": kernel.entity_count(),
                "can_undo": kernel.can_undo(),
                "can_redo": kernel.can_redo(),
                "event_count": kernel.event_count(),
            });
            Response {
                success: true,
                result: Some(state),
                error: None,
            }
        }
        _ => Response {
            success: false,
            result: None,
            error: Some(format!("Unknown tool: {}", req.tool)),
        },
    }
}

fn main() {
    let mut kernel = Kernel::new();
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut stdout = stdout.lock();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let response = match serde_json::from_str::<Request>(trimmed) {
            Ok(req) => handle_request(&mut kernel, req),
            Err(e) => Response {
                success: false,
                result: None,
                error: Some(format!("Invalid JSON: {}", e)),
            },
        };

        let output = serde_json::to_string(&response)
            .unwrap_or_else(|_| r#"{"success":false,"error":"Serialization error"}"#.to_string());
        let _ = writeln!(stdout, "{}", output);
        let _ = stdout.flush();
    }
}
