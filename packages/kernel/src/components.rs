use crate::entity::{EntityStyle, GeometryType};

pub type GeometryData = GeometryType;

#[derive(Debug, Clone)]
pub struct Geometry(pub GeometryData);

#[derive(Debug, Clone)]
pub struct LayerRef(pub String);

#[derive(Debug, Clone)]
pub struct Style(pub EntityStyle);

#[derive(Debug, Clone)]
pub struct EntityName(pub String);

#[derive(Debug, Clone)]
pub struct DrawOrder(pub i32);

#[derive(Debug, Clone)]
pub struct BIMProperties {
    pub ifc_class: String,
}
