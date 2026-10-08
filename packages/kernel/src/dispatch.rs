use crate::commands::{Command, CommandResult};
use crate::constraints;
use crate::styles;
use crate::units::{AngularUnit, LinearUnit};
use crate::Kernel;

pub(crate) fn execute(kernel: &mut Kernel, command: Command) -> CommandResult {
    match command {
        Command::CreatePoint { x, y, layer_id } => {
            let id = kernel.create_point(x, y, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateLine {
            x1,
            y1,
            x2,
            y2,
            layer_id,
        } => {
            let id = kernel.create_line(x1, y1, x2, y2, &layer_id);
            let warnings = kernel.validate_entity(&id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings,
            }
        }
        Command::CreateCircle {
            cx,
            cy,
            radius,
            layer_id,
        } => {
            let id = kernel.create_circle(cx, cy, radius, &layer_id);
            let warnings = kernel.validate_entity(&id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings,
            }
        }
        Command::CreateArc {
            cx,
            cy,
            radius,
            start_angle,
            end_angle,
            layer_id,
        } => {
            let id = kernel.create_arc(cx, cy, radius, start_angle, end_angle, &layer_id);
            let warnings = kernel.validate_entity(&id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings,
            }
        }
        Command::CreateRectangle {
            x,
            y,
            width,
            height,
            layer_id,
        } => {
            let id = kernel.create_rectangle(x, y, width, height, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreatePolyline {
            vertices,
            closed,
            layer_id,
        } => {
            let coords: Vec<f64> = vertices.iter().flat_map(|(x, y)| vec![*x, *y]).collect();
            let json = serde_json::to_string(&coords).unwrap_or_default();
            let id = kernel.create_polyline(&json, closed, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::DeleteEntity { id } => {
            let ok = kernel.delete_entity(&id);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: if ok {
                    None
                } else {
                    Some("Entity not found".into())
                },
                measurement: None,
                warnings: vec![],
            }
        }
        Command::MoveEntity { id, dx, dy } => {
            let ok = kernel.move_entity(&id, dx, dy);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: if ok {
                    None
                } else {
                    Some("Entity not found".into())
                },
                measurement: None,
                warnings: vec![],
            }
        }
        Command::RotateEntity { id, cx, cy, angle } => {
            let ok = kernel.rotate_entity(&id, cx, cy, angle);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: if ok {
                    None
                } else {
                    Some("Entity not found".into())
                },
                measurement: None,
                warnings: vec![],
            }
        }
        Command::ScaleEntity { id, cx, cy, factor } => {
            let ok = kernel.scale_entity(&id, cx, cy, factor);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: if ok {
                    None
                } else {
                    Some("Entity not found".into())
                },
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CopyEntity { id } => {
            let new_id = kernel.copy_entity(&id);
            if new_id.is_empty() {
                CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Entity not found".into()),
                    measurement: None,
                    warnings: vec![],
                }
            } else {
                CommandResult {
                    success: true,
                    created_ids: vec![new_id],
                    error: None,
                    measurement: None,
                    warnings: vec![],
                }
            }
        }
        Command::MirrorEntity { id, x1, y1, x2, y2 } => {
            let new_id = kernel.mirror_entity(&id, x1, y1, x2, y2);
            if new_id.is_empty() {
                CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Mirror failed".into()),
                    measurement: None,
                    warnings: vec![],
                }
            } else {
                CommandResult {
                    success: true,
                    created_ids: vec![new_id],
                    error: None,
                    measurement: None,
                    warnings: vec![],
                }
            }
        }
        Command::OffsetEntity { id, distance } => match kernel.offset_entity(&id, distance) {
            Ok(new_id) => CommandResult {
                success: true,
                created_ids: vec![new_id],
                error: None,
                measurement: None,
                warnings: vec![],
            },
            Err(e) => CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(e),
                measurement: None,
                warnings: vec![],
            },
        },
        Command::TrimEntity {
            id,
            boundary_id,
            pick_x,
            pick_y,
        } => {
            let ok = kernel.trim_entity(&id, &boundary_id, pick_x, pick_y);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: if ok { None } else { Some("Trim failed".into()) },
                measurement: None,
                warnings: vec![],
            }
        }
        Command::ModifyGeometry { id, geometry_json } => {
            let ok = kernel.update_entity_geometry(&id, &geometry_json);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: if ok {
                    None
                } else {
                    Some("Modify failed".into())
                },
                measurement: None,
                warnings: vec![],
            }
        }
        Command::Fillet { id_a, id_b, radius } => kernel.fillet(&id_a, &id_b, radius),
        Command::Chamfer {
            id_a,
            id_b,
            dist_a,
            dist_b,
        } => kernel.chamfer(&id_a, &id_b, dist_a, dist_b),
        Command::Explode { entity_id } => kernel.explode(&entity_id),
        Command::ExtendEntity { id, boundary_id } => kernel.extend_entity(&id, &boundary_id),
        Command::JoinEntities { ids } => {
            let id_refs: Vec<String> = ids;
            kernel.join_entities(&id_refs)
        }
        Command::CreateLayer { name, color } => {
            let id = kernel.create_layer(&name, &color);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::DeleteLayer { id } => {
            let ok = kernel.delete_layer(&id);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: if ok {
                    None
                } else {
                    Some("Cannot delete layer".into())
                },
                measurement: None,
                warnings: vec![],
            }
        }
        Command::SetLayerVisible { id, visible } => {
            let ok = kernel.set_layer_visible(&id, visible);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::SetLayerLocked { id, locked } => {
            let ok = kernel.set_layer_locked(&id, locked);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::SetLayerColor { id, color } => {
            let ok = kernel.set_layer_color(&id, &color);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::RenameLayer { id, name } => {
            let ok = kernel.rename_layer(&id, &name);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::SetEntityLayer {
            entity_id,
            layer_id,
        } => {
            let ok = kernel.set_entity_layer(&entity_id, &layer_id);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::AddConstraintHorizontal { entity_id } => {
            let id = kernel.add_constraint_horizontal(&entity_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::AddConstraintVertical { entity_id } => {
            let id = kernel.add_constraint_vertical(&entity_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::AddConstraintCoincident {
            entity_a,
            point_a,
            entity_b,
            point_b,
        } => {
            let id = kernel.add_constraint_coincident(&entity_a, point_a, &entity_b, point_b);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::AddConstraintDistance {
            entity_a,
            point_a,
            entity_b,
            point_b,
            distance,
        } => {
            let id =
                kernel.add_constraint_distance(&entity_a, point_a, &entity_b, point_b, distance);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::AddConstraintFixed {
            entity_id,
            point_index,
            x,
            y,
        } => {
            let id = kernel.add_constraint_fixed(&entity_id, point_index, x, y);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::AddConstraintParallel { entity_a, entity_b } => {
            let id = kernel.add_constraint_parallel(&entity_a, &entity_b);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::AddConstraintPerpendicular { entity_a, entity_b } => {
            let id = kernel.add_constraint_perpendicular(&entity_a, &entity_b);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::RemoveConstraint { id } => {
            let ok = kernel.remove_constraint(&id);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateText {
            x,
            y,
            content,
            height,
            rotation,
            layer_id,
        } => {
            let id = kernel.create_text(x, y, &content, height, rotation, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateDimension {
            x1,
            y1,
            x2,
            y2,
            offset,
            layer_id,
        } => {
            let id = kernel.create_dimension(x1, y1, x2, y2, offset, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateEllipse {
            cx,
            cy,
            semi_major,
            semi_minor,
            rotation,
            layer_id,
        } => {
            let id = kernel.create_ellipse(cx, cy, semi_major, semi_minor, rotation, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateSpline {
            control_points,
            degree,
            closed,
            layer_id,
        } => {
            let json = serde_json::to_string(&control_points).unwrap_or_default();
            let id = kernel.create_spline(&json, degree, closed, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateConstructionLine {
            ox,
            oy,
            dx,
            dy,
            layer_id,
        } => {
            let id = kernel.create_construction_line(ox, oy, dx, dy, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateEllipseArc {
            cx,
            cy,
            semi_major,
            semi_minor,
            rotation,
            start_angle,
            end_angle,
            layer_id,
        } => {
            let id = kernel.create_ellipse_arc(
                cx,
                cy,
                semi_major,
                semi_minor,
                rotation,
                start_angle,
                end_angle,
                &layer_id,
            );
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateMline {
            vertices,
            offsets,
            layer_id,
        } => {
            let coords: Vec<f64> = vertices.iter().flat_map(|(x, y)| vec![*x, *y]).collect();
            let coords_json = serde_json::to_string(&coords).unwrap_or_default();
            let offsets_json = serde_json::to_string(&offsets).unwrap_or_default();
            kernel.create_mline(&coords_json, &offsets_json, &layer_id)
        }
        Command::CreateWipeout { vertices, layer_id } => {
            let coords: Vec<f64> = vertices.iter().flat_map(|(x, y)| vec![*x, *y]).collect();
            let json = serde_json::to_string(&coords).unwrap_or_default();
            let id = kernel.create_wipeout(&json, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::Overkill { ids, tolerance } => {
            let ids_json = serde_json::to_string(&ids).unwrap_or_default();
            kernel.overkill(&ids_json, tolerance)
        }
        Command::SetLtscale { scale } => kernel.set_ltscale(scale),
        Command::GetLtscale => kernel.get_ltscale(),
        Command::CreateOrdinateDimension {
            feature_x,
            feature_y,
            leader_end_x,
            leader_end_y,
            use_x_datum,
            layer_id,
        } => {
            let id = kernel.create_ordinate_dimension(
                feature_x,
                feature_y,
                leader_end_x,
                leader_end_y,
                use_x_datum,
                &layer_id,
            );
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::MassProperties { entity_id } => kernel.mass_properties(&entity_id),
        Command::CreateTolerance {
            x,
            y,
            content,
            height,
            layer_id,
        } => {
            let id = kernel.create_tolerance(x, y, &content, height, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::WriteBlock {
            block_name,
            file_path,
        } => kernel.write_block(&block_name, &file_path),
        Command::CreateAttdef {
            x,
            y,
            tag,
            prompt,
            default_value,
            height,
            layer_id,
        } => {
            let id = kernel.create_attdef(x, y, &tag, &prompt, &default_value, height, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::AttachXref {
            file_path,
            x,
            y,
            scale,
            layer_id,
        } => kernel.attach_xref(&file_path, x, y, scale, &layer_id),
        Command::BeditEnter { block_id } => kernel.bedit_enter(&block_id),
        Command::BeditExit => kernel.bedit_exit(),
        Command::ToggleConstraintBar => CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec!["Constraint bar toggled".into()],
        },
        Command::PlotToPdf {
            file_path,
            paper_width,
            paper_height,
            scale,
        } => kernel.plot_to_pdf(&file_path, paper_width, paper_height, scale),
        Command::SaveDrawing { file_path } => kernel.save_drawing(&file_path),
        Command::OpenDrawing { file_path } => kernel.open_drawing(&file_path),
        Command::DetectBoundary { x, y, layer_id } => kernel.detect_boundary(x, y, &layer_id),
        Command::CreateRegion {
            boundary_ids,
            layer_id,
        } => {
            let ids_json = serde_json::to_string(&boundary_ids).unwrap_or_default();
            kernel.create_region(&ids_json, &layer_id)
        }
        Command::AutoConstrain { ids, tolerance } => {
            let ids_json = serde_json::to_string(&ids).unwrap_or_default();
            kernel.auto_constrain(&ids_json, tolerance)
        }
        Command::StretchEntities {
            ids,
            window_x1,
            window_y1,
            window_x2,
            window_y2,
            dx,
            dy,
        } => {
            let ids_json = serde_json::to_string(&ids).unwrap_or_default();
            kernel.stretch_entities(
                &ids_json, window_x1, window_y1, window_x2, window_y2, dx, dy,
            )
        }
        Command::ArrayPath {
            entity_ids,
            path_id,
            count,
            align_to_path,
        } => {
            let ids_json = serde_json::to_string(&entity_ids).unwrap_or_default();
            kernel.array_path(&ids_json, &path_id, count, align_to_path)
        }
        Command::DimContinue {
            prev_dim_id,
            x,
            y,
            layer_id,
        } => kernel.dim_continue(&prev_dim_id, x, y, &layer_id),
        Command::DimBaseline {
            base_dim_id,
            x,
            y,
            offset_increment,
            layer_id,
        } => kernel.dim_baseline(&base_dim_id, x, y, offset_increment, &layer_id),
        Command::AlignEntities {
            ids,
            src1_x,
            src1_y,
            dst1_x,
            dst1_y,
            src2_x,
            src2_y,
            dst2_x,
            dst2_y,
        } => {
            let ids_json = serde_json::to_string(&ids).unwrap_or_default();
            kernel.align_entities(
                &ids_json, src1_x, src1_y, dst1_x, dst1_y, src2_x, src2_y, dst2_x, dst2_y,
            )
        }
        Command::PurgeUnused => kernel.purge_unused(),
        Command::CreatePolygon {
            cx,
            cy,
            radius,
            sides,
            inscribed,
            rotation,
            layer_id,
        } => kernel.create_polygon(cx, cy, radius, sides, inscribed, rotation, &layer_id),
        Command::CreateRay {
            ox,
            oy,
            dx,
            dy,
            layer_id,
        } => {
            let id = kernel.create_ray(ox, oy, dx, dy, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateDonut {
            cx,
            cy,
            inner_radius,
            outer_radius,
            layer_id,
        } => kernel.create_donut(cx, cy, inner_radius, outer_radius, &layer_id),
        Command::CreateLeader {
            vertices,
            text,
            arrow_size,
            text_height,
            layer_id,
        } => {
            let coords: Vec<f64> = vertices.iter().flat_map(|(x, y)| vec![*x, *y]).collect();
            let json = serde_json::to_string(&coords).unwrap_or_default();
            let id = kernel.create_leader(&json, &text, arrow_size, text_height, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::PeditClose { id } => kernel.pedit_close(&id),
        Command::PeditOpen { id } => kernel.pedit_open(&id),
        Command::PeditAddVertex {
            id,
            after_index,
            x,
            y,
        } => kernel.pedit_add_vertex(&id, after_index as usize, x, y),
        Command::PeditDeleteVertex { id, vertex_index } => {
            kernel.pedit_delete_vertex(&id, vertex_index as usize)
        }
        Command::PeditMoveVertex {
            id,
            vertex_index,
            x,
            y,
        } => kernel.pedit_move_vertex(&id, vertex_index as usize, x, y),
        Command::SendToBack { id } => kernel.set_draw_order(&id, i32::MIN),
        Command::BringToFront { id } => kernel.set_draw_order(&id, i32::MAX),
        Command::SendBackward { id } => kernel.adjust_draw_order(&id, -1),
        Command::BringForward { id } => kernel.adjust_draw_order(&id, 1),
        Command::QueryPoint { x, y } => CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![format!("X = {x:.6}  Y = {y:.6}")],
        },
        Command::CreateBlock {
            name,
            base_x,
            base_y,
            entity_ids,
        } => kernel.create_block_cmd(&name, base_x, base_y, &entity_ids),
        Command::InsertBlock {
            block_id,
            x,
            y,
            rotation,
            scale_x,
            scale_y,
            layer_id,
        } => kernel.insert_block_cmd(&block_id, x, y, rotation, scale_x, scale_y, &layer_id),
        Command::ExplodeBlock { entity_id } => kernel.explode_block_cmd(&entity_id),
        Command::ArrayRectangular {
            entity_ids,
            rows,
            cols,
            row_spacing,
            col_spacing,
        } => kernel.array_rectangular(&entity_ids, rows, cols, row_spacing, col_spacing),
        Command::ArrayPolar {
            entity_ids,
            center_x,
            center_y,
            count,
            angle,
            rotate_items,
        } => kernel.array_polar(&entity_ids, center_x, center_y, count, angle, rotate_items),
        Command::AddConstraintTangent {
            line_entity,
            circle_entity,
        } => {
            let id = kernel.add_constraint_tangent(&line_entity, &circle_entity);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::AddConstraintConcentric { entity_a, entity_b } => {
            let id = kernel.add_constraint_concentric(&entity_a, &entity_b);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::AddConstraintSymmetric {
            entity_id,
            axis_entity,
        } => {
            let id = kernel.add_constraint_symmetric(&entity_id, &axis_entity);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::AnalyzeDof => {
            let json = kernel.analyze_dof_json();
            CommandResult {
                success: true,
                created_ids: vec![],
                error: Some(json),
                measurement: None,
                warnings: vec![],
            }
        }
        Command::AddConstraintEqualLength { entity_a, entity_b } => {
            let id =
                kernel
                    .constraint_solver
                    .add_constraint(constraints::ConstraintType::EqualLength {
                        entity_a: entity_a.clone(),
                        entity_b: entity_b.clone(),
                    });
            kernel.solve_constraints_inner();
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateAlignedDimension {
            x1,
            y1,
            x2,
            y2,
            offset,
            layer_id,
        } => {
            let id = kernel.create_aligned_dimension(x1, y1, x2, y2, offset, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateAngularDimension {
            cx,
            cy,
            sx,
            sy,
            ex,
            ey,
            radius,
            layer_id,
        } => {
            let id = kernel.create_angular_dimension(cx, cy, sx, sy, ex, ey, radius, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateRadialDimension {
            cx,
            cy,
            px,
            py,
            layer_id,
        } => {
            let id = kernel.create_radial_dimension(cx, cy, px, py, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateDiameterDimension {
            cx,
            cy,
            px,
            py,
            layer_id,
        } => {
            let id = kernel.create_diameter_dimension(cx, cy, px, py, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::MeasureDistance { x1, y1, x2, y2 } => kernel.measure_distance_cmd(x1, y1, x2, y2),
        Command::MeasureArea { entity_id } => kernel.measure_area_cmd(&entity_id),
        Command::SetEntityColor { id, color } => styles::set_entity_color(
            &mut kernel.ecs_world,
            &mut kernel.event_store,
            &mut kernel.dirty_ids,
            id,
            color,
        ),
        Command::SetEntityLinetype { id, linetype } => styles::set_entity_linetype(
            &mut kernel.ecs_world,
            &mut kernel.event_store,
            &mut kernel.dirty_ids,
            id,
            linetype,
        ),
        Command::SetEntityLineweight { id, lineweight } => styles::set_entity_lineweight(
            &mut kernel.ecs_world,
            &mut kernel.event_store,
            &mut kernel.dirty_ids,
            id,
            lineweight,
        ),
        Command::SetLayerLinetype { id, linetype } => {
            styles::set_layer_linetype(&mut kernel.layers, &id, linetype)
        }
        Command::SetLayerLineweight { id, lineweight } => {
            styles::set_layer_lineweight(&mut kernel.layers, &id, lineweight)
        }
        Command::CreateHatch {
            boundary_ids,
            pattern,
            scale,
            angle,
            layer_id,
        } => kernel.create_hatch_cmd(boundary_ids, &pattern, scale, angle, &layer_id),
        Command::CreateMText {
            x,
            y,
            content,
            width,
            height,
            rotation,
            layer_id,
        } => kernel.create_mtext_cmd(x, y, &content, width, height, rotation, &layer_id),
        Command::CreateTable {
            x,
            y,
            rows,
            cols,
            row_height,
            col_widths,
            cells,
            layer_id,
        } => kernel.create_table_cmd(x, y, rows, cols, row_height, col_widths, cells, &layer_id),
        Command::MatchProperties {
            source_id,
            target_ids,
        } => kernel.match_properties_cmd(&source_id, &target_ids),
        Command::Lengthen {
            entity_id,
            mode,
            value,
            end,
        } => {
            let ok = kernel.lengthen_entity(&entity_id, &mode, value, &end);
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: if ok {
                    None
                } else {
                    Some("Lengthen failed".into())
                },
                measurement: None,
                warnings: vec![],
            }
        }
        Command::BreakAtPoint { entity_id, px, py } => kernel.break_at_point(&entity_id, px, py),
        Command::Break {
            entity_id,
            x1,
            y1,
            x2,
            y2,
        } => kernel.break_two_points(&entity_id, x1, y1, x2, y2),
        Command::CreateRevisionCloud {
            vertices,
            arc_length,
            layer_id,
        } => {
            let coords: Vec<f64> = vertices.iter().flat_map(|(x, y)| vec![*x, *y]).collect();
            let json = serde_json::to_string(&coords).unwrap_or_default();
            let al = arc_length.unwrap_or(0.5);
            let id = kernel.create_revision_cloud(&json, al, &layer_id);
            CommandResult {
                success: true,
                created_ids: vec![id],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateCircle3P {
            x1,
            y1,
            x2,
            y2,
            x3,
            y3,
            layer_id,
        } => kernel.create_circle_3p(x1, y1, x2, y2, x3, y3, &layer_id),
        Command::CreateCircle2P {
            x1,
            y1,
            x2,
            y2,
            layer_id,
        } => kernel.create_circle_2p(x1, y1, x2, y2, &layer_id),
        Command::CreateCircleTtr {
            entity1_id,
            pick1_x,
            pick1_y,
            entity2_id,
            pick2_x,
            pick2_y,
            radius,
            layer_id,
        } => kernel.create_circle_ttr(
            &entity1_id,
            pick1_x,
            pick1_y,
            &entity2_id,
            pick2_x,
            pick2_y,
            radius,
            &layer_id,
        ),
        Command::FilletPolyline { id, radius } => crate::geometry_ops::fillet_polyline(
            &mut kernel.ecs_world,
            &mut kernel.event_store,
            &mut kernel.dirty_ids,
            &mut kernel.next_id,
            &id,
            radius,
        ),
        Command::OffsetEntityThrough {
            id,
            through_x,
            through_y,
        } => {
            match crate::geometry_ops::offset_entity_through(
                &mut kernel.ecs_world,
                &mut kernel.event_store,
                &mut kernel.dirty_ids,
                &mut kernel.last_created_id,
                &mut kernel.next_id,
                &id,
                through_x,
                through_y,
            ) {
                Ok(new_id) => CommandResult {
                    success: true,
                    created_ids: vec![new_id],
                    error: None,
                    measurement: None,
                    warnings: vec![],
                },
                Err(e) => CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(e),
                    measurement: None,
                    warnings: vec![],
                },
            }
        }
        Command::Undo => {
            let ok = kernel.undo();
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::Redo => {
            let ok = kernel.redo();
            CommandResult {
                success: ok,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::CreateTextStyle {
            name,
            font_family,
            height,
            width_factor,
            oblique_angle,
            is_bold,
            is_italic,
        } => kernel.create_text_style_cmd(
            &name,
            font_family,
            height,
            width_factor,
            oblique_angle,
            is_bold,
            is_italic,
        ),
        Command::ModifyTextStyle {
            name,
            font_family,
            height,
            width_factor,
            oblique_angle,
            is_bold,
            is_italic,
        } => kernel.modify_text_style_cmd(
            &name,
            font_family,
            height,
            width_factor,
            oblique_angle,
            is_bold,
            is_italic,
        ),
        Command::DeleteTextStyle { name } => kernel.delete_text_style_cmd(&name),
        Command::SetCurrentTextStyle { name } => kernel.set_current_text_style_cmd(&name),
        Command::CreateDimStyle {
            name,
            dimscale,
            dimtxt,
            dimasz,
            dimexo,
            dimexe,
            dimgap,
            dimtad,
            dimclrt,
            dimclrd,
            dimclre,
            dimtxsty,
        } => kernel.create_dim_style_cmd(
            &name, dimscale, dimtxt, dimasz, dimexo, dimexe, dimgap, dimtad, dimclrt, dimclrd,
            dimclre, dimtxsty,
        ),
        Command::ModifyDimStyle {
            name,
            dimscale,
            dimtxt,
            dimasz,
            dimexo,
            dimexe,
            dimgap,
            dimtad,
            dimclrt,
            dimclrd,
            dimclre,
            dimtxsty,
        } => kernel.modify_dim_style_cmd(
            &name, dimscale, dimtxt, dimasz, dimexo, dimexe, dimgap, dimtad, dimclrt, dimclrd,
            dimclre, dimtxsty,
        ),
        Command::DeleteDimStyle { name } => kernel.delete_dim_style_cmd(&name),
        Command::SetCurrentDimStyle { name } => kernel.set_current_dim_style_cmd(&name),
        Command::CreateMLeaderStyle {
            name,
            arrow_size,
            text_height,
            text_style_name,
            landing_distance,
            enable_landing,
            enable_dogleg,
            color,
        } => kernel.create_mleader_style_cmd(
            &name,
            arrow_size,
            text_height,
            text_style_name,
            landing_distance,
            enable_landing,
            enable_dogleg,
            color,
        ),
        Command::ModifyMLeaderStyle {
            name,
            arrow_size,
            text_height,
            text_style_name,
            landing_distance,
            enable_landing,
            enable_dogleg,
            color,
        } => kernel.modify_mleader_style_cmd(
            &name,
            arrow_size,
            text_height,
            text_style_name,
            landing_distance,
            enable_landing,
            enable_dogleg,
            color,
        ),
        Command::DeleteMLeaderStyle { name } => kernel.delete_mleader_style_cmd(&name),
        Command::SetCurrentMLeaderStyle { name } => kernel.set_current_mleader_style_cmd(&name),
        Command::CreateTableStyle {
            name,
            text_style_name,
            data_text_height,
            header_text_height,
            title_text_height,
            has_title,
            has_header,
            cell_margin,
            border_color,
            title_fill_color,
            header_fill_color,
        } => kernel.create_table_style_cmd(
            &name,
            text_style_name,
            data_text_height,
            header_text_height,
            title_text_height,
            has_title,
            has_header,
            cell_margin,
            border_color,
            title_fill_color,
            header_fill_color,
        ),
        Command::ModifyTableStyle {
            name,
            text_style_name,
            data_text_height,
            header_text_height,
            title_text_height,
            has_title,
            has_header,
            cell_margin,
            border_color,
            title_fill_color,
            header_fill_color,
        } => kernel.modify_table_style_cmd(
            &name,
            text_style_name,
            data_text_height,
            header_text_height,
            title_text_height,
            has_title,
            has_header,
            cell_margin,
            border_color,
            title_fill_color,
            header_fill_color,
        ),
        Command::DeleteTableStyle { name } => kernel.delete_table_style_cmd(&name),
        Command::SetCurrentTableStyle { name } => kernel.set_current_table_style_cmd(&name),
        Command::SetDwgProps {
            title,
            subject,
            author,
            keywords,
            comments,
            hyperlink_base,
            last_saved_by,
        } => kernel.set_dwg_props_cmd(
            title,
            subject,
            author,
            keywords,
            comments,
            hyperlink_base,
            last_saved_by,
        ),
        Command::CreateGroup {
            name,
            entity_ids,
            selectable,
        } => kernel.create_group_cmd(name, entity_ids, selectable),
        Command::DeleteGroup { name } => kernel.delete_group_cmd(&name),
        Command::RenameGroup { old_name, new_name } => {
            kernel.rename_group_cmd(&old_name, &new_name)
        }
        Command::AddToGroup { name, entity_ids } => kernel.add_to_group_cmd(&name, entity_ids),
        Command::RemoveFromGroup { name, entity_ids } => {
            kernel.remove_from_group_cmd(&name, entity_ids)
        }
        Command::SetGroupSelectable { name, selectable } => {
            kernel.set_group_selectable_cmd(&name, selectable)
        }
        Command::SaveUcs {
            name,
            origin_x,
            origin_y,
            x_axis_x,
            x_axis_y,
            y_axis_x,
            y_axis_y,
        } => kernel.save_ucs_cmd(
            &name, origin_x, origin_y, x_axis_x, x_axis_y, y_axis_x, y_axis_y,
        ),
        Command::DeleteUcs { name } => kernel.delete_ucs_cmd(&name),
        Command::SetCurrentUcs { name } => kernel.set_current_ucs_cmd(&name),
        Command::SaveNamedView {
            name,
            center_x,
            center_y,
            zoom,
            rotation,
        } => kernel.save_named_view_cmd(&name, center_x, center_y, zoom, rotation),
        Command::DeleteNamedView { name } => kernel.delete_named_view_cmd(&name),
        Command::RenameNamedView { old_name, new_name } => {
            kernel.rename_named_view_cmd(&old_name, &new_name)
        }
        Command::SetSysvar { name, value } => {
            kernel.set_sysvar(&name, value);
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::GetSysvar { name } => {
            let val = kernel.get_sysvar(&name);
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: Some(val),
                warnings: vec![],
            }
        }
        Command::SetSysvarTyped { name, value_json } => {
            if kernel.set_sysvar_typed_json(&name, &value_json) {
                CommandResult {
                    success: true,
                    created_ids: vec![],
                    error: None,
                    measurement: None,
                    warnings: vec![],
                }
            } else {
                CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("invalid SysvarValue JSON for {name}: {value_json}")),
                    measurement: None,
                    warnings: vec![],
                }
            }
        }
        Command::GetSysvarTyped { name } => {
            let json = kernel.get_sysvar_typed_json(&name);
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![json],
            }
        }
        Command::SetUnits {
            linear_type,
            linear_precision,
            angular_type,
            angular_precision,
            insertion_scale,
        } => {
            if let Some(lt) = linear_type {
                kernel.units.linear_type = match lt.to_lowercase().as_str() {
                    "decimal" => LinearUnit::Decimal,
                    "engineering" => LinearUnit::Engineering,
                    "architectural" => LinearUnit::Architectural,
                    "fractional" => LinearUnit::Fractional,
                    "scientific" => LinearUnit::Scientific,
                    _ => kernel.units.linear_type.clone(),
                };
            }
            if let Some(lp) = linear_precision {
                kernel.units.linear_precision = lp.min(8);
            }
            if let Some(at) = angular_type {
                kernel.units.angular_type = match at.to_lowercase().as_str() {
                    "decimaldegrees" | "decimal_degrees" | "degrees" => AngularUnit::DecimalDegrees,
                    "dms" => AngularUnit::DMS,
                    "grads" => AngularUnit::Grads,
                    "radians" => AngularUnit::Radians,
                    _ => kernel.units.angular_type.clone(),
                };
            }
            if let Some(ap) = angular_precision {
                kernel.units.angular_precision = ap.min(8);
            }
            if let Some(is) = insertion_scale {
                kernel.units.insertion_scale = is;
            }
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        Command::GetUnits => CommandResult {
            success: true,
            created_ids: vec![],
            error: Some(kernel.get_units_json()),
            measurement: None,
            warnings: vec![],
        },
    }
}

#[cfg(test)]
mod tests {
    use crate::Kernel;

    fn exec(k: &mut Kernel, json: &str) -> serde_json::Value {
        let r = k.execute_command(json);
        serde_json::from_str(&r).unwrap()
    }

    fn assert_ok(r: &serde_json::Value) {
        assert_eq!(r["success"], true, "Expected success: {}", r);
    }

    fn assert_fail(r: &serde_json::Value) {
        assert_eq!(r["success"], false, "Expected failure: {}", r);
    }

    // ── Creation ────────────────────────────────────────────────────────────

    #[test]
    fn create_point() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreatePoint","x":1.0,"y":2.0,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
        assert_eq!(r["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_line() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
        assert_eq!(r["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_circle() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0,"cy":0,"radius":5,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
        assert_eq!(r["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_arc() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateArc","cx":0,"cy":0,"radius":5,"start_angle":0,"end_angle":90,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
    }

    #[test]
    fn create_rectangle() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateRectangle","x":0,"y":0,"width":10,"height":5,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
    }

    #[test]
    fn create_polyline() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0,0],[10,0],[10,10]],"closed":false,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
    }

    #[test]
    fn create_text() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateText","x":1,"y":2,"content":"NEXUS","height":2.5,"rotation":0,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
    }

    #[test]
    fn create_dimension() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateDimension","x1":0,"y1":0,"x2":10,"y2":0,"offset":3,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
    }

    #[test]
    fn create_ellipse() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateEllipse","cx":0,"cy":0,"semi_major":8,"semi_minor":4,"rotation":0,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
    }

    #[test]
    fn create_spline() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateSpline","control_points":[[0,0],[5,5],[10,0]],"degree":2,"closed":false,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
    }

    #[test]
    fn create_construction_line() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateConstructionLine","ox":0,"oy":0,"dx":1,"dy":0,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
    }

    #[test]
    fn create_circle_3p() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateCircle3P","x1":0,"y1":1,"x2":1,"y2":0,"x3":-1,"y3":0,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
    }

    #[test]
    fn create_circle_2p() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateCircle2P","x1":-5,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
    }

    // ── Editing ─────────────────────────────────────────────────────────────

    #[test]
    fn delete_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let json = format!(r#"{{"type":"DeleteEntity","id":"{}"}}"#, id);
        let r = exec(&mut k, &json);
        assert_ok(&r);
        assert_eq!(k.entity_count(), 0);
    }

    #[test]
    fn move_entity() {
        let mut k = Kernel::new();
        let id = k.create_point(0.0, 0.0, "layer_0");
        let json = format!(r#"{{"type":"MoveEntity","id":"{}","dx":5,"dy":3}}"#, id);
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn rotate_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let json = format!(
            r#"{{"type":"RotateEntity","id":"{}","cx":0,"cy":0,"angle":45}}"#,
            id
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn scale_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let json = format!(
            r#"{{"type":"ScaleEntity","id":"{}","cx":0,"cy":0,"factor":2.0}}"#,
            id
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn copy_entity() {
        let mut k = Kernel::new();
        let id = k.create_circle(0.0, 0.0, 5.0, "layer_0");
        let json = format!(r#"{{"type":"CopyEntity","id":"{}"}}"#, id);
        let r = exec(&mut k, &json);
        assert_ok(&r);
        assert_eq!(k.entity_count(), 2);
    }

    #[test]
    fn mirror_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(1.0, 0.0, 5.0, 0.0, "layer_0");
        let json = format!(
            r#"{{"type":"MirrorEntity","id":"{}","x1":0,"y1":0,"x2":0,"y2":1}}"#,
            id
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
        assert_eq!(k.entity_count(), 2);
    }

    // ── Geometry ops ────────────────────────────────────────────────────────

    #[test]
    fn offset_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let json = format!(r#"{{"type":"OffsetEntity","id":"{}","distance":2.0}}"#, id);
        let r = exec(&mut k, &json);
        assert_ok(&r);
        assert_eq!(k.entity_count(), 2);
    }

    #[test]
    fn trim_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let boundary = k.create_line(5.0, -5.0, 5.0, 5.0, "layer_0");
        let json = format!(
            r#"{{"type":"TrimEntity","id":"{}","boundary_id":"{}","pick_x":2,"pick_y":0}}"#,
            id, boundary
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn extend_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 8.0, 0.0, "layer_0");
        let boundary = k.create_line(10.0, -5.0, 10.0, 5.0, "layer_0");
        let json = format!(
            r#"{{"type":"ExtendEntity","id":"{}","boundary_id":"{}"}}"#,
            id, boundary
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn fillet() {
        let mut k = Kernel::new();
        let id_a = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let id_b = k.create_line(0.0, 0.0, 0.0, 10.0, "layer_0");
        let json = format!(
            r#"{{"type":"Fillet","id_a":"{}","id_b":"{}","radius":2.0}}"#,
            id_a, id_b
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn chamfer() {
        let mut k = Kernel::new();
        let id_a = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let id_b = k.create_line(0.0, 0.0, 0.0, 10.0, "layer_0");
        let json = format!(
            r#"{{"type":"Chamfer","id_a":"{}","id_b":"{}","dist_a":2.0,"dist_b":2.0}}"#,
            id_a, id_b
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn explode_polyline() {
        let mut k = Kernel::new();
        let r0 = exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0,0],[10,0],[10,10]],"closed":false,"layer_id":"layer_0"}"#,
        );
        let poly_id = r0["created_ids"][0].as_str().unwrap().to_string();
        let json = format!(r#"{{"type":"Explode","entity_id":"{}"}}"#, poly_id);
        let r = exec(&mut k, &json);
        assert_ok(&r);
        assert!(r["created_ids"].as_array().unwrap().len() >= 2);
    }

    #[test]
    fn break_at_point() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let json = format!(
            r#"{{"type":"BreakAtPoint","entity_id":"{}","px":5,"py":0}}"#,
            id
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn break_two_points() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let json = format!(
            r#"{{"type":"Break","entity_id":"{}","x1":3,"y1":0,"x2":7,"y2":0}}"#,
            id
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn lengthen() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let json = format!(
            r#"{{"type":"Lengthen","entity_id":"{}","mode":"delta","value":5.0,"end":"end"}}"#,
            id
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn join_entities() {
        let mut k = Kernel::new();
        let id_a = k.create_line(0.0, 0.0, 5.0, 0.0, "layer_0");
        let id_b = k.create_line(5.0, 0.0, 10.0, 0.0, "layer_0");
        let json = format!(r#"{{"type":"JoinEntities","ids":["{}","{}"]}}"#, id_a, id_b);
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    // ── Constraints ─────────────────────────────────────────────────────────

    #[test]
    fn add_constraint_horizontal() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 1.0, "layer_0");
        let json = format!(
            r#"{{"type":"AddConstraintHorizontal","entity_id":"{}"}}"#,
            id
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
        assert_eq!(r["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn add_constraint_distance() {
        let mut k = Kernel::new();
        let id_a = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let id_b = k.create_line(0.0, 5.0, 10.0, 5.0, "layer_0");
        let json = format!(
            r#"{{"type":"AddConstraintDistance","entity_a":"{}","point_a":0,"entity_b":"{}","point_b":0,"distance":5.0}}"#,
            id_a, id_b
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn remove_constraint() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let add_json = format!(
            r#"{{"type":"AddConstraintHorizontal","entity_id":"{}"}}"#,
            id
        );
        let r_add = exec(&mut k, &add_json);
        let constraint_id = r_add["created_ids"][0].as_str().unwrap().to_string();
        let rem_json = format!(r#"{{"type":"RemoveConstraint","id":"{}"}}"#, constraint_id);
        let r = exec(&mut k, &rem_json);
        assert_ok(&r);
    }

    #[test]
    fn solve_constraints_via_add() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 1.0, "layer_0");
        let json = format!(
            r#"{{"type":"AddConstraintHorizontal","entity_id":"{}"}}"#,
            id
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    // ── Layers ───────────────────────────────────────────────────────────────

    #[test]
    fn create_layer() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"Walls","color":"#ff0000"}"##,
        );
        assert_ok(&r);
        assert_eq!(r["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn set_layer_visible() {
        let mut k = Kernel::new();
        let r_create = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"L1","color":"#00ff00"}"##,
        );
        let lid = r_create["created_ids"][0].as_str().unwrap().to_string();
        let json = format!(
            r#"{{"type":"SetLayerVisible","id":"{}","visible":false}}"#,
            lid
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn set_layer_locked() {
        let mut k = Kernel::new();
        let r_create = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"L2","color":"#0000ff"}"##,
        );
        let lid = r_create["created_ids"][0].as_str().unwrap().to_string();
        let json = format!(
            r#"{{"type":"SetLayerLocked","id":"{}","locked":true}}"#,
            lid
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn rename_layer() {
        let mut k = Kernel::new();
        let r_create = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"OldName","color":"#ffffff"}"##,
        );
        let lid = r_create["created_ids"][0].as_str().unwrap().to_string();
        let json = format!(
            r#"{{"type":"RenameLayer","id":"{}","name":"NewName"}}"#,
            lid
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn set_entity_layer() {
        let mut k = Kernel::new();
        let r_layer = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"Target","color":"#aaaaaa"}"##,
        );
        let lid = r_layer["created_ids"][0].as_str().unwrap().to_string();
        let eid = k.create_line(0.0, 0.0, 5.0, 5.0, "layer_0");
        let json = format!(
            r#"{{"type":"SetEntityLayer","entity_id":"{}","layer_id":"{}"}}"#,
            eid, lid
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    // ── Blocks ───────────────────────────────────────────────────────────────

    #[test]
    fn create_block() {
        let mut k = Kernel::new();
        let id_a = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let id_b = k.create_line(0.0, 0.0, 0.0, 10.0, "layer_0");
        let json = format!(
            r#"{{"type":"CreateBlock","name":"MyBlock","base_x":0,"base_y":0,"entity_ids":["{}","{}"]}}"#,
            id_a, id_b
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    #[test]
    fn insert_block() {
        let mut k = Kernel::new();
        let eid = k.create_line(0.0, 0.0, 5.0, 0.0, "layer_0");
        let create_json = format!(
            r#"{{"type":"CreateBlock","name":"Blk","base_x":0,"base_y":0,"entity_ids":["{}"]}}"#,
            eid
        );
        let r_block = exec(&mut k, &create_json);
        let block_id = r_block["created_ids"][0].as_str().unwrap().to_string();
        let ins_json = format!(
            r#"{{"type":"InsertBlock","block_id":"{}","x":20,"y":20,"rotation":0,"scale_x":1,"scale_y":1,"layer_id":"layer_0"}}"#,
            block_id
        );
        let r = exec(&mut k, &ins_json);
        assert_ok(&r);
    }

    #[test]
    fn array_rectangular() {
        let mut k = Kernel::new();
        let eid = k.create_point(0.0, 0.0, "layer_0");
        let json = format!(
            r#"{{"type":"ArrayRectangular","entity_ids":["{}"],"rows":2,"cols":3,"row_spacing":10,"col_spacing":10}}"#,
            eid
        );
        let r = exec(&mut k, &json);
        assert_ok(&r);
        assert!(r["created_ids"].as_array().unwrap().len() >= 1);
    }

    // ── Dimensions ──────────────────────────────────────────────────────────

    #[test]
    fn create_aligned_dimension() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateAlignedDimension","x1":0,"y1":0,"x2":10,"y2":5,"offset":3,"layer_id":"layer_0"}"#,
        );
        assert_ok(&r);
    }

    #[test]
    fn measure_distance() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"MeasureDistance","x1":0,"y1":0,"x2":3,"y2":4}"#,
        );
        assert_ok(&r);
        let dist = r["measurement"].as_f64().unwrap();
        assert!((dist - 5.0).abs() < 1e-9, "expected 5.0 got {}", dist);
    }

    #[test]
    fn measure_area() {
        let mut k = Kernel::new();
        let id = k.create_rectangle(0.0, 0.0, 4.0, 3.0, "layer_0");
        let json = format!(r#"{{"type":"MeasureArea","entity_id":"{}"}}"#, id);
        let r = exec(&mut k, &json);
        assert_ok(&r);
    }

    // ── Undo / Redo ──────────────────────────────────────────────────────────

    #[test]
    fn undo_redo_round_trip() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreatePoint","x":1,"y":2,"layer_id":"layer_0"}"#,
        );
        assert_eq!(k.entity_count(), 1);
        let r_undo = exec(&mut k, r#"{"type":"Undo"}"#);
        assert_ok(&r_undo);
        assert_eq!(k.entity_count(), 0);
        let r_redo = exec(&mut k, r#"{"type":"Redo"}"#);
        assert_ok(&r_redo);
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn undo_nothing_returns_false() {
        let mut k = Kernel::new();
        let r = exec(&mut k, r#"{"type":"Undo"}"#);
        // Nothing to undo — kernel returns success:false (no history)
        assert_eq!(r["success"], false);
    }

    // ── Sysvars ──────────────────────────────────────────────────────────────

    #[test]
    fn set_get_sysvar_round_trip() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SetSysvar","name":"FILLETRAD","value":3.5}"#,
        );
        let r = exec(&mut k, r#"{"type":"GetSysvar","name":"FILLETRAD"}"#);
        assert_ok(&r);
        let val = r["measurement"].as_f64().unwrap();
        assert!((val - 3.5).abs() < 1e-9);
    }

    #[test]
    fn get_unknown_sysvar_returns_zero() {
        let mut k = Kernel::new();
        let r = exec(&mut k, r#"{"type":"GetSysvar","name":"UNKNOWN_VAR"}"#);
        assert_ok(&r);
    }

    #[test]
    fn set_sysvar_typed_int_round_trips_via_get_sysvar_typed() {
        let mut k = Kernel::new();
        let r_set = exec(
            &mut k,
            r#"{"type":"SetSysvarTyped","name":"OSMODE","value_json":"{\"Int\":4133}"}"#,
        );
        assert_ok(&r_set);
        let r_get = exec(&mut k, r#"{"type":"GetSysvarTyped","name":"OSMODE"}"#);
        assert_ok(&r_get);
        let json = r_get["warnings"][0].as_str().unwrap();
        assert_eq!(json, r#"{"Int":4133}"#);
    }

    #[test]
    fn set_sysvar_typed_string_round_trips() {
        let mut k = Kernel::new();
        let r_set = exec(
            &mut k,
            r#"{"type":"SetSysvarTyped","name":"CLAYER","value_json":"{\"String\":\"0\"}"}"#,
        );
        assert_ok(&r_set);
        let r_get = exec(&mut k, r#"{"type":"GetSysvarTyped","name":"CLAYER"}"#);
        let json = r_get["warnings"][0].as_str().unwrap();
        assert_eq!(json, r#"{"String":"0"}"#);
    }

    #[test]
    fn set_sysvar_typed_point2d_round_trips() {
        let mut k = Kernel::new();
        let r_set = exec(
            &mut k,
            r#"{"type":"SetSysvarTyped","name":"GRIDUNIT","value_json":"{\"Point2d\":{\"x\":0.5,\"y\":0.5}}"}"#,
        );
        assert_ok(&r_set);
        let r_get = exec(&mut k, r#"{"type":"GetSysvarTyped","name":"GRIDUNIT"}"#);
        let json = r_get["warnings"][0].as_str().unwrap();
        assert_eq!(json, r#"{"Point2d":{"x":0.5,"y":0.5}}"#);
    }

    #[test]
    fn set_sysvar_typed_with_invalid_json_fails_cleanly() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"SetSysvarTyped","name":"OSMODE","value_json":"not valid json"}"#,
        );
        assert_eq!(r["success"], false);
    }

    #[test]
    fn get_sysvar_typed_for_unknown_var_returns_null_in_warnings() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"GetSysvarTyped","name":"DOES_NOT_EXIST"}"#,
        );
        assert_ok(&r);
        let json = r["warnings"][0].as_str().unwrap();
        assert_eq!(json, "null");
    }

    #[test]
    fn legacy_set_sysvar_still_writes_float_after_refactor() {
        // Pre-S4 sysvars (FILLETRAD etc.) must keep working through the f64 API.
        // After SetSysvarTyped exists, SetSysvar still writes a Float entry.
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SetSysvar","name":"FILLETRAD","value":7.25}"#,
        );
        let r = exec(&mut k, r#"{"type":"GetSysvarTyped","name":"FILLETRAD"}"#);
        let json = r["warnings"][0].as_str().unwrap();
        assert_eq!(json, r#"{"Float":7.25}"#);
    }

    // ── Units ────────────────────────────────────────────────────────────────

    #[test]
    fn set_get_units() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"SetUnits","linear_type":"architectural","linear_precision":4,"angular_type":"dms","angular_precision":2}"#,
        );
        let r = exec(&mut k, r#"{"type":"GetUnits"}"#);
        assert_ok(&r);
        let payload = r["error"].as_str().unwrap();
        assert!(
            payload.contains("Architectural") || payload.contains("architectural"),
            "got: {}",
            payload
        );
    }

    // ── Error paths ──────────────────────────────────────────────────────────

    #[test]
    fn malformed_json_returns_failure() {
        let mut k = Kernel::new();
        let r = exec(&mut k, "this is not json at all");
        assert_fail(&r);
        assert!(r["error"].as_str().is_some());
    }

    #[test]
    fn missing_required_field_returns_failure() {
        let mut k = Kernel::new();
        // CreateLine missing y2
        let r = exec(&mut k, r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10}"#);
        assert_fail(&r);
    }

    #[test]
    fn operation_on_nonexistent_entity_returns_failure() {
        let mut k = Kernel::new();
        let r = exec(&mut k, r#"{"type":"DeleteEntity","id":"does_not_exist"}"#);
        assert_fail(&r);
    }
}
