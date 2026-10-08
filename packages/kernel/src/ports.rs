use crate::constraints::{Constraint, ConstraintType, DofResult};
use crate::entity::Entity;

pub trait ConstraintSolverPort {
    fn add_constraint(&mut self, ct: ConstraintType) -> String;
    fn remove_constraint(&mut self, id: &str) -> bool;
    fn remove_constraints_for_entity(&mut self, entity_id: &str);
    fn solve(&self, entities: &mut [Entity]) -> bool;
    fn get_constraints_json(&self) -> String;
    fn get_constraints(&self) -> Vec<Constraint>;
    fn constraint_count(&self) -> usize;
    fn constrained_entity_ids(&self) -> Vec<String>;
    fn analyze_dof(&self, entities: &[Entity]) -> DofResult;
}
