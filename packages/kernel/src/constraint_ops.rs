use crate::constraints;
use crate::entity;
use crate::Kernel;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
impl Kernel {
    pub fn add_constraint_horizontal(&mut self, entity_id: &str) -> String {
        let id = self
            .constraint_solver
            .add_constraint(constraints::ConstraintType::Horizontal {
                entity_id: entity_id.to_string(),
            });
        self.solve_constraints_inner();
        id
    }

    pub fn add_constraint_vertical(&mut self, entity_id: &str) -> String {
        let id = self
            .constraint_solver
            .add_constraint(constraints::ConstraintType::Vertical {
                entity_id: entity_id.to_string(),
            });
        self.solve_constraints_inner();
        id
    }

    pub fn add_constraint_coincident(
        &mut self,
        entity_a: &str,
        point_a: usize,
        entity_b: &str,
        point_b: usize,
    ) -> String {
        let id = self
            .constraint_solver
            .add_constraint(constraints::ConstraintType::Coincident {
                entity_a: entity_a.to_string(),
                point_a,
                entity_b: entity_b.to_string(),
                point_b,
            });
        self.solve_constraints_inner();
        id
    }

    pub fn add_constraint_distance(
        &mut self,
        entity_a: &str,
        point_a: usize,
        entity_b: &str,
        point_b: usize,
        distance: f64,
    ) -> String {
        let id = self
            .constraint_solver
            .add_constraint(constraints::ConstraintType::Distance {
                entity_a: entity_a.to_string(),
                point_a,
                entity_b: entity_b.to_string(),
                point_b,
                distance,
            });
        self.solve_constraints_inner();
        id
    }

    pub fn add_constraint_fixed(
        &mut self,
        entity_id: &str,
        point_index: usize,
        x: f64,
        y: f64,
    ) -> String {
        let id = self
            .constraint_solver
            .add_constraint(constraints::ConstraintType::Fixed {
                entity_id: entity_id.to_string(),
                point_index,
                position: entity::Point2D::new(x, y),
            });
        self.solve_constraints_inner();
        id
    }

    pub fn add_constraint_parallel(&mut self, entity_a: &str, entity_b: &str) -> String {
        let id = self
            .constraint_solver
            .add_constraint(constraints::ConstraintType::Parallel {
                entity_a: entity_a.to_string(),
                entity_b: entity_b.to_string(),
            });
        self.solve_constraints_inner();
        id
    }

    pub fn add_constraint_perpendicular(&mut self, entity_a: &str, entity_b: &str) -> String {
        let id =
            self.constraint_solver
                .add_constraint(constraints::ConstraintType::Perpendicular {
                    entity_a: entity_a.to_string(),
                    entity_b: entity_b.to_string(),
                });
        self.solve_constraints_inner();
        id
    }

    pub fn add_constraint_tangent(&mut self, line_entity: &str, circle_entity: &str) -> String {
        let id = self
            .constraint_solver
            .add_constraint(constraints::ConstraintType::Tangent {
                line_entity: line_entity.to_string(),
                circle_entity: circle_entity.to_string(),
            });
        self.solve_constraints_inner();
        id
    }

    pub fn add_constraint_concentric(&mut self, entity_a: &str, entity_b: &str) -> String {
        let id = self
            .constraint_solver
            .add_constraint(constraints::ConstraintType::Concentric {
                entity_a: entity_a.to_string(),
                entity_b: entity_b.to_string(),
            });
        self.solve_constraints_inner();
        id
    }

    pub fn add_constraint_symmetric(&mut self, entity_id: &str, axis_entity: &str) -> String {
        let id = self
            .constraint_solver
            .add_constraint(constraints::ConstraintType::Symmetric {
                entity_id: entity_id.to_string(),
                axis_entity: axis_entity.to_string(),
            });
        self.solve_constraints_inner();
        id
    }

    pub fn analyze_dof_json(&self) -> String {
        let entities: Vec<entity::Entity> = self.ecs_world.cache_values_cloned();
        let result = self.constraint_solver.analyze_dof(&entities);
        serde_json::to_string(&result).unwrap_or_default()
    }

    pub fn remove_constraint(&mut self, id: &str) -> bool {
        self.constraint_solver.remove_constraint(id)
    }

    pub fn get_constraints_json(&self) -> String {
        self.constraint_solver.get_constraints_json()
    }

    pub fn constraint_count(&self) -> usize {
        self.constraint_solver.constraint_count()
    }

    pub fn solve_constraints(&mut self) -> bool {
        self.solve_constraints_inner()
    }
}
