use crate::constraints::ConstraintType;
use crate::entity::{Entity, GeometryType, Point2D};
use ezpz::datatypes::inputs::{DatumLineSegment, DatumPoint};
use ezpz::{Config, Constraint as EzConstraint, ConstraintRequest, IdGenerator};

#[derive(Debug)]
pub struct SolveResult {
    pub converged: bool,
    pub positions: Vec<(String, usize, f64, f64)>,
    #[allow(dead_code)]
    #[allow(dead_code)]
    pub iterations: usize,
}

struct PointMapping {
    entity_id: String,
    point_index: usize,
    datum: DatumPoint,
}

struct LineMapping {
    entity_id: String,
    segment: DatumLineSegment,
}

fn get_point(entity: &Entity, index: usize) -> Option<Point2D> {
    match &entity.geometry {
        GeometryType::Line { start, end } => match index {
            0 => Some(start.clone()),
            1 => Some(end.clone()),
            _ => None,
        },
        GeometryType::Circle { center, .. } | GeometryType::Arc { center, .. } => match index {
            0 => Some(center.clone()),
            _ => None,
        },
        _ => None,
    }
}

pub fn solve_with_ezpz(
    entities: &[Entity],
    constraints: &[crate::constraints::Constraint],
) -> SolveResult {
    let mut ids = IdGenerator::default();
    let mut point_mappings: Vec<PointMapping> = Vec::new();
    let mut line_mappings: Vec<LineMapping> = Vec::new();
    let mut initial_guesses: Vec<(ezpz::Id, f64)> = Vec::new();

    // Helper: find or create a DatumPoint for (entity_id, point_index)
    let find_or_create_point = |entity_id: &str,
                                point_index: usize,
                                ids: &mut IdGenerator,
                                mappings: &mut Vec<PointMapping>,
                                guesses: &mut Vec<(ezpz::Id, f64)>,
                                entities: &[Entity]|
     -> Option<DatumPoint> {
        if let Some(mapping) = mappings
            .iter()
            .find(|m| m.entity_id == entity_id && m.point_index == point_index)
        {
            return Some(mapping.datum);
        }

        let entity = entities.iter().find(|e| e.id == entity_id)?;
        let pt = get_point(entity, point_index)?;
        let datum = DatumPoint::new(ids);
        guesses.push((datum.id_x(), pt.x));
        guesses.push((datum.id_y(), pt.y));
        mappings.push(PointMapping {
            entity_id: entity_id.to_string(),
            point_index,
            datum,
        });
        Some(datum)
    };

    // Helper: find or create a DatumLineSegment for an entity
    let find_or_create_line = |entity_id: &str,
                               ids: &mut IdGenerator,
                               point_mappings: &mut Vec<PointMapping>,
                               line_mappings: &mut Vec<LineMapping>,
                               guesses: &mut Vec<(ezpz::Id, f64)>,
                               entities: &[Entity]|
     -> Option<DatumLineSegment> {
        if let Some(mapping) = line_mappings.iter().find(|m| m.entity_id == entity_id) {
            return Some(mapping.segment);
        }

        let p0 = find_or_create_point(entity_id, 0, ids, point_mappings, guesses, entities)?;
        let p1 = find_or_create_point(entity_id, 1, ids, point_mappings, guesses, entities)?;
        let segment = DatumLineSegment::new(p0, p1);
        line_mappings.push(LineMapping {
            entity_id: entity_id.to_string(),
            segment,
        });
        Some(segment)
    };

    let mut requests: Vec<ConstraintRequest> = Vec::new();

    for constraint in constraints {
        match &constraint.constraint_type {
            ConstraintType::Fixed {
                entity_id,
                point_index,
                position,
            } => {
                if let Some(datum) = find_or_create_point(
                    entity_id,
                    *point_index,
                    &mut ids,
                    &mut point_mappings,
                    &mut initial_guesses,
                    entities,
                ) {
                    requests.push(ConstraintRequest::highest_priority(EzConstraint::Fixed(
                        datum.id_x(),
                        position.x,
                    )));
                    requests.push(ConstraintRequest::highest_priority(EzConstraint::Fixed(
                        datum.id_y(),
                        position.y,
                    )));
                }
            }

            ConstraintType::Coincident {
                entity_a,
                point_a,
                entity_b,
                point_b,
            } => {
                let da = find_or_create_point(
                    entity_a,
                    *point_a,
                    &mut ids,
                    &mut point_mappings,
                    &mut initial_guesses,
                    entities,
                );
                let db = find_or_create_point(
                    entity_b,
                    *point_b,
                    &mut ids,
                    &mut point_mappings,
                    &mut initial_guesses,
                    entities,
                );
                if let (Some(da), Some(db)) = (da, db) {
                    requests.push(ConstraintRequest::highest_priority(
                        EzConstraint::PointsCoincident(da, db),
                    ));
                }
            }

            ConstraintType::Horizontal { entity_id } => {
                if let Some(seg) = find_or_create_line(
                    entity_id,
                    &mut ids,
                    &mut point_mappings,
                    &mut line_mappings,
                    &mut initial_guesses,
                    entities,
                ) {
                    requests.push(ConstraintRequest::highest_priority(
                        EzConstraint::Horizontal(seg),
                    ));
                }
            }

            ConstraintType::Vertical { entity_id } => {
                if let Some(seg) = find_or_create_line(
                    entity_id,
                    &mut ids,
                    &mut point_mappings,
                    &mut line_mappings,
                    &mut initial_guesses,
                    entities,
                ) {
                    requests.push(ConstraintRequest::highest_priority(EzConstraint::Vertical(
                        seg,
                    )));
                }
            }

            ConstraintType::Distance {
                entity_a,
                point_a,
                entity_b,
                point_b,
                distance,
            } => {
                let da = find_or_create_point(
                    entity_a,
                    *point_a,
                    &mut ids,
                    &mut point_mappings,
                    &mut initial_guesses,
                    entities,
                );
                let db = find_or_create_point(
                    entity_b,
                    *point_b,
                    &mut ids,
                    &mut point_mappings,
                    &mut initial_guesses,
                    entities,
                );
                if let (Some(da), Some(db)) = (da, db) {
                    requests.push(ConstraintRequest::highest_priority(EzConstraint::Distance(
                        da, db, *distance,
                    )));
                }
            }

            ConstraintType::Parallel { entity_a, entity_b } => {
                let la = find_or_create_line(
                    entity_a,
                    &mut ids,
                    &mut point_mappings,
                    &mut line_mappings,
                    &mut initial_guesses,
                    entities,
                );
                let lb = find_or_create_line(
                    entity_b,
                    &mut ids,
                    &mut point_mappings,
                    &mut line_mappings,
                    &mut initial_guesses,
                    entities,
                );
                if let (Some(la), Some(lb)) = (la, lb) {
                    requests.push(ConstraintRequest::highest_priority(
                        EzConstraint::LinesAtAngle(la, lb, ezpz::datatypes::AngleKind::Parallel),
                    ));
                }
            }

            ConstraintType::Perpendicular { entity_a, entity_b } => {
                let la = find_or_create_line(
                    entity_a,
                    &mut ids,
                    &mut point_mappings,
                    &mut line_mappings,
                    &mut initial_guesses,
                    entities,
                );
                let lb = find_or_create_line(
                    entity_b,
                    &mut ids,
                    &mut point_mappings,
                    &mut line_mappings,
                    &mut initial_guesses,
                    entities,
                );
                if let (Some(la), Some(lb)) = (la, lb) {
                    requests.push(ConstraintRequest::highest_priority(
                        EzConstraint::LinesAtAngle(
                            la,
                            lb,
                            ezpz::datatypes::AngleKind::Perpendicular,
                        ),
                    ));
                }
            }

            ConstraintType::EqualLength { entity_a, entity_b } => {
                let la = find_or_create_line(
                    entity_a,
                    &mut ids,
                    &mut point_mappings,
                    &mut line_mappings,
                    &mut initial_guesses,
                    entities,
                );
                let lb = find_or_create_line(
                    entity_b,
                    &mut ids,
                    &mut point_mappings,
                    &mut line_mappings,
                    &mut initial_guesses,
                    entities,
                );
                if let (Some(la), Some(lb)) = (la, lb) {
                    requests.push(ConstraintRequest::highest_priority(
                        EzConstraint::LinesEqualLength(la, lb),
                    ));
                }
            }

            // New constraint types — not yet mapped to ezpz primitives, handled by Gauss-Seidel solver
            ConstraintType::Tangent { .. }
            | ConstraintType::Concentric { .. }
            | ConstraintType::Symmetric { .. } => {}
        }
    }

    if requests.is_empty() {
        return SolveResult {
            converged: true,
            positions: Vec::new(),
            iterations: 0,
        };
    }

    let config = Config::default();
    match ezpz::solve(&requests, initial_guesses.clone(), config) {
        Ok(outcome) => {
            let vals = outcome.final_values();
            let mut positions = Vec::new();
            for mapping in &point_mappings {
                let x_idx = initial_guesses
                    .iter()
                    .position(|(id, _)| *id == mapping.datum.id_x());
                let y_idx = initial_guesses
                    .iter()
                    .position(|(id, _)| *id == mapping.datum.id_y());
                if let (Some(xi), Some(yi)) = (x_idx, y_idx) {
                    positions.push((
                        mapping.entity_id.clone(),
                        mapping.point_index,
                        vals[xi],
                        vals[yi],
                    ));
                }
            }
            SolveResult {
                converged: outcome.is_satisfied(),
                positions,
                iterations: outcome.iterations(),
            }
        }
        Err(_failure) => SolveResult {
            converged: false,
            positions: Vec::new(),
            iterations: 0,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constraints::{Constraint, ConstraintSolver, ConstraintType};
    use crate::entity::{Entity, EntityStyle, GeometryType, Point2D};
    use std::time::Instant;

    fn make_line(id: &str, x1: f64, y1: f64, x2: f64, y2: f64) -> Entity {
        Entity {
            id: id.to_string(),
            geometry: GeometryType::Line {
                start: Point2D::new(x1, y1),
                end: Point2D::new(x2, y2),
            },
            layer_id: "layer_0".to_string(),
            style: EntityStyle::default(),
            draw_order: 0,
        }
    }

    #[test]
    fn test_ezpz_fixed_constraint() {
        let entities = vec![make_line("l1", 1.0, 2.0, 5.0, 6.0)];
        let constraints = vec![Constraint {
            id: "c1".to_string(),
            constraint_type: ConstraintType::Fixed {
                entity_id: "l1".to_string(),
                point_index: 0,
                position: Point2D::new(0.0, 0.0),
            },
        }];

        let result = solve_with_ezpz(&entities, &constraints);
        assert!(result.converged);
        let pos = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 0)
            .unwrap();
        assert!((pos.2 - 0.0).abs() < 1e-6);
        assert!((pos.3 - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_ezpz_coincident_constraint() {
        let entities = vec![
            make_line("l1", 0.0, 0.0, 10.0, 0.0),
            make_line("l2", 12.0, 3.0, 20.0, 5.0),
        ];
        let constraints = vec![Constraint {
            id: "c1".to_string(),
            constraint_type: ConstraintType::Coincident {
                entity_a: "l1".to_string(),
                point_a: 1,
                entity_b: "l2".to_string(),
                point_b: 0,
            },
        }];

        let result = solve_with_ezpz(&entities, &constraints);
        assert!(result.converged);

        let p1 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 1)
            .unwrap();
        let p2 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l2" && *idx == 0)
            .unwrap();
        let dist = ((p1.2 - p2.2).powi(2) + (p1.3 - p2.3).powi(2)).sqrt();
        assert!(dist < 1e-4, "Points should coincide, dist={}", dist);
    }

    #[test]
    fn test_ezpz_horizontal_constraint() {
        let entities = vec![make_line("l1", 0.0, 0.0, 10.0, 5.0)];
        let constraints = vec![Constraint {
            id: "c1".to_string(),
            constraint_type: ConstraintType::Horizontal {
                entity_id: "l1".to_string(),
            },
        }];

        let result = solve_with_ezpz(&entities, &constraints);
        assert!(result.converged);

        let p0 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 0)
            .unwrap();
        let p1 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 1)
            .unwrap();
        assert!(
            (p0.3 - p1.3).abs() < 1e-4,
            "Line should be horizontal, y0={}, y1={}",
            p0.3,
            p1.3
        );
    }

    #[test]
    fn test_ezpz_vertical_constraint() {
        let entities = vec![make_line("l1", 0.0, 0.0, 5.0, 10.0)];
        let constraints = vec![Constraint {
            id: "c1".to_string(),
            constraint_type: ConstraintType::Vertical {
                entity_id: "l1".to_string(),
            },
        }];

        let result = solve_with_ezpz(&entities, &constraints);
        assert!(result.converged);

        let p0 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 0)
            .unwrap();
        let p1 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 1)
            .unwrap();
        assert!(
            (p0.2 - p1.2).abs() < 1e-4,
            "Line should be vertical, x0={}, x1={}",
            p0.2,
            p1.2
        );
    }

    #[test]
    fn test_ezpz_distance_constraint() {
        let entities = vec![
            make_line("l1", 0.0, 0.0, 1.0, 0.0),
            make_line("l2", 3.0, 0.0, 4.0, 0.0),
        ];
        let constraints = vec![
            Constraint {
                id: "c1".to_string(),
                constraint_type: ConstraintType::Fixed {
                    entity_id: "l1".to_string(),
                    point_index: 0,
                    position: Point2D::new(0.0, 0.0),
                },
            },
            Constraint {
                id: "c2".to_string(),
                constraint_type: ConstraintType::Distance {
                    entity_a: "l1".to_string(),
                    point_a: 0,
                    entity_b: "l2".to_string(),
                    point_b: 0,
                    distance: 5.0,
                },
            },
        ];

        let result = solve_with_ezpz(&entities, &constraints);
        assert!(result.converged);

        let p_l1_0 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 0)
            .unwrap();
        let p_l2_0 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l2" && *idx == 0)
            .unwrap();
        let dist = ((p_l1_0.2 - p_l2_0.2).powi(2) + (p_l1_0.3 - p_l2_0.3).powi(2)).sqrt();
        assert!(
            (dist - 5.0).abs() < 1e-4,
            "Distance should be 5.0, got {}",
            dist
        );
    }

    #[test]
    fn test_ezpz_parallel_constraint() {
        let entities = vec![
            make_line("l1", 0.0, 0.0, 10.0, 0.0),
            make_line("l2", 0.0, 5.0, 8.0, 7.0),
        ];
        let constraints = vec![Constraint {
            id: "c1".to_string(),
            constraint_type: ConstraintType::Parallel {
                entity_a: "l1".to_string(),
                entity_b: "l2".to_string(),
            },
        }];

        let result = solve_with_ezpz(&entities, &constraints);
        assert!(result.converged);

        let p0 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l2" && *idx == 0)
            .unwrap();
        let p1 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l2" && *idx == 1)
            .unwrap();
        // Check l2 is now parallel to l1 (horizontal): dy should be ~0
        // l1 is horizontal, so l2 should also be ~horizontal or anti-parallel
        let _dy = (p1.3 - p0.3).abs();
        let _dx = (p1.2 - p0.2).abs();
        // Check cross product of direction vectors is ~0 (parallel means same direction)
        let l1_p0 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 0)
            .unwrap();
        let l1_p1 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 1)
            .unwrap();
        let d1x = l1_p1.2 - l1_p0.2;
        let d1y = l1_p1.3 - l1_p0.3;
        let d2x = p1.2 - p0.2;
        let d2y = p1.3 - p0.3;
        let len1 = (d1x * d1x + d1y * d1y).sqrt();
        let len2 = (d2x * d2x + d2y * d2y).sqrt();
        let cross = (d1x * d2y - d1y * d2x).abs();
        let norm_cross = if len1 > 1e-10 && len2 > 1e-10 {
            cross / (len1 * len2)
        } else {
            cross
        };
        assert!(
            norm_cross < 0.15,
            "Lines should be parallel, normalized cross={}",
            norm_cross
        );
    }

    #[test]
    fn test_ezpz_perpendicular_constraint() {
        let entities = vec![
            make_line("l1", 0.0, 0.0, 10.0, 0.0),
            make_line("l2", 0.0, 0.0, 5.0, 3.0),
        ];
        let constraints = vec![Constraint {
            id: "c1".to_string(),
            constraint_type: ConstraintType::Perpendicular {
                entity_a: "l1".to_string(),
                entity_b: "l2".to_string(),
            },
        }];

        let result = solve_with_ezpz(&entities, &constraints);
        assert!(result.converged);

        let l1_p0 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 0)
            .unwrap();
        let l1_p1 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 1)
            .unwrap();
        let l2_p0 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l2" && *idx == 0)
            .unwrap();
        let l2_p1 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l2" && *idx == 1)
            .unwrap();

        let d1x = l1_p1.2 - l1_p0.2;
        let d1y = l1_p1.3 - l1_p0.3;
        let d2x = l2_p1.2 - l2_p0.2;
        let d2y = l2_p1.3 - l2_p0.3;
        let dot = d1x * d2x + d1y * d2y;
        assert!(
            dot.abs() < 1e-3,
            "Lines should be perpendicular, dot={}",
            dot
        );
    }

    #[test]
    fn test_ezpz_equal_length_constraint() {
        let entities = vec![
            make_line("l1", 0.0, 0.0, 10.0, 0.0),
            make_line("l2", 0.0, 5.0, 3.0, 5.0),
        ];
        let constraints = vec![Constraint {
            id: "c1".to_string(),
            constraint_type: ConstraintType::EqualLength {
                entity_a: "l1".to_string(),
                entity_b: "l2".to_string(),
            },
        }];

        let result = solve_with_ezpz(&entities, &constraints);
        assert!(result.converged);

        let l1_p0 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 0)
            .unwrap();
        let l1_p1 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l1" && *idx == 1)
            .unwrap();
        let l2_p0 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l2" && *idx == 0)
            .unwrap();
        let l2_p1 = result
            .positions
            .iter()
            .find(|(id, idx, _, _)| id == "l2" && *idx == 1)
            .unwrap();

        let len1 = ((l1_p1.2 - l1_p0.2).powi(2) + (l1_p1.3 - l1_p0.3).powi(2)).sqrt();
        let len2 = ((l2_p1.2 - l2_p0.2).powi(2) + (l2_p1.3 - l2_p0.3).powi(2)).sqrt();
        assert!(
            (len1 - len2).abs() < 1e-3,
            "Lengths should be equal: {} vs {}",
            len1,
            len2
        );
    }

    #[test]
    fn bench_ezpz_vs_handrolled() {
        // Create a more complex constrained sketch
        let mut entities = Vec::new();
        for i in 0..20 {
            let x = (i as f64) * 10.0;
            let y = (i as f64) * 5.0 + 1.0;
            entities.push(make_line(
                &format!("l{i}"),
                x,
                y,
                x + 8.0 + (i as f64),
                y + 3.0 + (i as f64) * 0.5,
            ));
        }

        let mut constraint_types = Vec::new();
        // Chain: fix first point, connect endpoints
        constraint_types.push(ConstraintType::Fixed {
            entity_id: "l0".to_string(),
            point_index: 0,
            position: Point2D::new(0.0, 0.0),
        });
        // Coincident chain
        for i in 0..14 {
            constraint_types.push(ConstraintType::Coincident {
                entity_a: format!("l{i}"),
                point_a: 1,
                entity_b: format!("l{}", i + 1),
                point_b: 0,
            });
        }

        let constraints: Vec<crate::constraints::Constraint> = constraint_types
            .iter()
            .enumerate()
            .map(|(i, ct)| crate::constraints::Constraint {
                id: format!("c{i}"),
                constraint_type: ct.clone(),
            })
            .collect();

        // Benchmark ezpz
        let start = Instant::now();
        let mut ezpz_result = None;
        for _ in 0..100 {
            ezpz_result = Some(solve_with_ezpz(&entities, &constraints));
        }
        let ezpz_time = start.elapsed();
        let ezpz_result = ezpz_result.unwrap();

        // Benchmark hand-rolled solver
        let start = Instant::now();
        let mut handrolled_converged = false;
        for _ in 0..100 {
            let mut solver = ConstraintSolver::new();
            for ct in &constraint_types {
                solver.add_constraint(ct.clone());
            }
            let mut ents = entities.clone();
            handrolled_converged = solver.solve(&mut ents);
        }
        let handrolled_time = start.elapsed();

        eprintln!("=== ezpz vs Hand-Rolled Constraint Solver Benchmark ===");
        eprintln!("Sketch: 20 entities, 15 constraints");
        eprintln!("100 iterations each:");
        eprintln!(
            "  ezpz:       {:?} (converged={}, iterations={})",
            ezpz_time, ezpz_result.converged, ezpz_result.iterations
        );
        eprintln!(
            "  hand-rolled: {:?} (converged={})",
            handrolled_time, handrolled_converged
        );
        eprintln!(
            "  ratio:       {:.1}x",
            ezpz_time.as_nanos() as f64 / handrolled_time.as_nanos() as f64
        );
        eprintln!("  ezpz positions resolved: {}", ezpz_result.positions.len());

        assert!(ezpz_result.converged, "ezpz should converge");
        assert!(handrolled_converged, "hand-rolled should converge");
    }
}
