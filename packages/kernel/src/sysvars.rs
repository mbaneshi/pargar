use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A NEXUS sysvar value. Mirrors the AutoCAD typing surface so the registry can
/// hold int bitfields (OSMODE, AUTOSNAP), floats (LTSCALE, FILLETRAD), strings
/// (CLAYER, CELTYPE), and 2D points (GRIDUNIT, SNAPBASE) without forcing every
/// sysvar through `f64`.
///
/// Externally-tagged serde representation keeps the JSON compact and
/// unambiguous on the WASM bridge:
///   `{"Int": 37}` / `{"Float": 1.0}` / `{"String": "ByLayer"}` /
///   `{"Point2d": {"x": 0.5, "y": 0.5}}`
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum SysvarValue {
    Int(i64),
    Float(f64),
    String(String),
    Point2d { x: f64, y: f64 },
}

impl SysvarValue {
    /// Adapter for the legacy `get_sysvar(&str) -> f64` accessor: Float entries
    /// pass through, Int entries widen, anything else collapses to 0.0. The 8
    /// pre-S4 sysvars (OFFSETDIST, FILLETRAD, TRIMMODE, …) are all `Float`, so
    /// the legacy API stays bit-identical for them.
    pub fn as_f64(&self) -> f64 {
        match self {
            SysvarValue::Float(v) => *v,
            SysvarValue::Int(v) => *v as f64,
            _ => 0.0,
        }
    }
}

/// Default sysvar registry. Defaults match AutoCAD 2026 docs; the 8 pre-S4
/// sysvars keep their original `Float` defaults from
/// `lib.rs:default_sysvars()` (now removed).
pub fn default_registry() -> HashMap<String, SysvarValue> {
    let mut m = HashMap::new();

    // Pre-S4: TRIM / EXTEND / OFFSET / FILLET / CHAMFER tunables.
    m.insert("OFFSETDIST".into(), SysvarValue::Float(0.0));
    m.insert("OFFSETGAPTYPE".into(), SysvarValue::Float(0.0));
    m.insert("OFFSETERASE".into(), SysvarValue::Float(0.0));
    m.insert("FILLETRAD".into(), SysvarValue::Float(0.0));
    m.insert("TRIMMODE".into(), SysvarValue::Float(1.0));
    m.insert("EDGEMODE".into(), SysvarValue::Float(0.0));
    m.insert("CHAMFERA".into(), SysvarValue::Float(0.0));
    m.insert("CHAMFERB".into(), SysvarValue::Float(0.0));

    // S4-A: Snap/Grid cluster (PARITY_GAP F1 + ORTHOMODE).
    // OSMODE: AutoCAD sticky default 4133 = END(1)+CEN(4)+INT(32)+EXT(4096).
    m.insert("OSMODE".into(), SysvarValue::Int(4133));
    m.insert("GRIDUNIT".into(), SysvarValue::Point2d { x: 0.5, y: 0.5 });
    m.insert("SNAPUNIT".into(), SysvarValue::Point2d { x: 0.5, y: 0.5 });
    m.insert("SNAPBASE".into(), SysvarValue::Point2d { x: 0.0, y: 0.0 });
    m.insert("SNAPMODE".into(), SysvarValue::Int(0));
    // GRIDMODE: AutoCAD acad.dwt default = 1 (grid display on).
    m.insert("GRIDMODE".into(), SysvarValue::Int(1));
    m.insert("ORTHOMODE".into(), SysvarValue::Int(0));
    m.insert("SNAPANG".into(), SysvarValue::Float(0.0));
    m.insert("POLARMODE".into(), SysvarValue::Int(0));
    // AUTOSNAP bits: marker(1)+magnet(2)+tooltip(4)+aperture(8)+
    //                polar-track(16)+otrack(32) = 63.
    m.insert("AUTOSNAP".into(), SysvarValue::Int(63));

    // S4-A: Linetype cluster (PARITY_GAP F3).
    m.insert("LTSCALE".into(), SysvarValue::Float(1.0));
    m.insert("CELTSCALE".into(), SysvarValue::Float(1.0));
    m.insert("PSLTSCALE".into(), SysvarValue::Int(1));
    m.insert("CELTYPE".into(), SysvarValue::String("ByLayer".into()));
    m.insert("CECOLOR".into(), SysvarValue::String("BYLAYER".into()));
    m.insert("CLAYER".into(), SysvarValue::String("0".into()));
    // CELWEIGHT: -1 = ByLayer, -2 = ByBlock, -3 = Default; otherwise the
    // weight in 1/100 mm.
    m.insert("CELWEIGHT".into(), SysvarValue::Int(-1));

    m
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn int_round_trips_through_json_with_externally_tagged_shape() {
        let v = SysvarValue::Int(4133);
        let json = serde_json::to_string(&v).unwrap();
        assert_eq!(json, r#"{"Int":4133}"#);
        let parsed: SysvarValue = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, v);
    }

    #[test]
    fn float_round_trips_through_json() {
        let v = SysvarValue::Float(1.5);
        let json = serde_json::to_string(&v).unwrap();
        assert_eq!(json, r#"{"Float":1.5}"#);
        assert_eq!(serde_json::from_str::<SysvarValue>(&json).unwrap(), v);
    }

    #[test]
    fn string_round_trips_through_json() {
        let v = SysvarValue::String("ByLayer".into());
        let json = serde_json::to_string(&v).unwrap();
        assert_eq!(json, r#"{"String":"ByLayer"}"#);
        assert_eq!(serde_json::from_str::<SysvarValue>(&json).unwrap(), v);
    }

    #[test]
    fn point2d_round_trips_through_json() {
        let v = SysvarValue::Point2d { x: 0.5, y: 0.5 };
        let json = serde_json::to_string(&v).unwrap();
        assert_eq!(json, r#"{"Point2d":{"x":0.5,"y":0.5}}"#);
        assert_eq!(serde_json::from_str::<SysvarValue>(&json).unwrap(), v);
    }

    #[test]
    fn as_f64_passes_through_float_widens_int_collapses_others() {
        assert_eq!(SysvarValue::Float(1.5).as_f64(), 1.5);
        assert_eq!(SysvarValue::Int(42).as_f64(), 42.0);
        assert_eq!(SysvarValue::String("x".into()).as_f64(), 0.0);
        assert_eq!(SysvarValue::Point2d { x: 1.0, y: 2.0 }.as_f64(), 0.0);
    }

    #[test]
    fn default_registry_contains_the_eight_pre_s4_sysvars_as_floats() {
        let r = default_registry();
        for name in [
            "OFFSETDIST",
            "OFFSETGAPTYPE",
            "OFFSETERASE",
            "FILLETRAD",
            "TRIMMODE",
            "EDGEMODE",
            "CHAMFERA",
            "CHAMFERB",
        ] {
            match r.get(name) {
                Some(SysvarValue::Float(_)) => {}
                other => panic!("expected {name} = Float, got {other:?}"),
            }
        }
    }

    #[test]
    fn legacy_pre_s4_defaults_match_lib_rs_default_sysvars() {
        let r = default_registry();
        // Identical to the f64 values previously in lib.rs:default_sysvars().
        assert_eq!(r["OFFSETDIST"].as_f64(), 0.0);
        assert_eq!(r["OFFSETGAPTYPE"].as_f64(), 0.0);
        assert_eq!(r["OFFSETERASE"].as_f64(), 0.0);
        assert_eq!(r["FILLETRAD"].as_f64(), 0.0);
        assert_eq!(r["TRIMMODE"].as_f64(), 1.0);
        assert_eq!(r["EDGEMODE"].as_f64(), 0.0);
        assert_eq!(r["CHAMFERA"].as_f64(), 0.0);
        assert_eq!(r["CHAMFERB"].as_f64(), 0.0);
    }

    // ── Snap/Grid cluster (PARITY_GAP F1 + ORTHOMODE) ───────────────────────

    #[test]
    fn snap_grid_cluster_present_with_canonical_autocad_defaults() {
        let r = default_registry();
        // OSMODE: Int bitfield. AutoCAD 2026 sticky default is 4133
        // (END=1 | CEN=4 | INT=32 | EXT=4096).
        assert_eq!(r["OSMODE"], SysvarValue::Int(4133));
        // GRIDUNIT / SNAPUNIT / SNAPBASE: Point2d. acad.dwt defaults.
        assert_eq!(r["GRIDUNIT"], SysvarValue::Point2d { x: 0.5, y: 0.5 });
        assert_eq!(r["SNAPUNIT"], SysvarValue::Point2d { x: 0.5, y: 0.5 });
        assert_eq!(r["SNAPBASE"], SysvarValue::Point2d { x: 0.0, y: 0.0 });
        // SNAPMODE: 0 (off). GRIDMODE: 1 (AutoCAD acad.dwt default — grid on).
        // ORTHOMODE: 0 (off).
        assert_eq!(r["SNAPMODE"], SysvarValue::Int(0));
        assert_eq!(r["GRIDMODE"], SysvarValue::Int(1));
        assert_eq!(r["ORTHOMODE"], SysvarValue::Int(0));
        // SNAPANG: Float radians, default 0.
        assert_eq!(r["SNAPANG"], SysvarValue::Float(0.0));
        // POLARMODE: Int bitfield, default 0 (no override).
        assert_eq!(r["POLARMODE"], SysvarValue::Int(0));
        // AUTOSNAP: Int bitfield. Default 63 = marker(1)+magnet(2)+
        //   tooltip(4)+aperture(8)+polar-track(16)+otrack(32).
        assert_eq!(r["AUTOSNAP"], SysvarValue::Int(63));
    }

    #[test]
    fn snap_grid_cluster_total_count_is_eight_pre_s4_plus_ten() {
        let r = default_registry();
        // 8 pre-S4 + 10 Snap/Grid = 18 (after this cluster lands).
        // Linetype cluster brings it to 25 in the next commit.
        assert!(r.len() >= 18);
    }

    // ── Linetype cluster (PARITY_GAP F3) ────────────────────────────────────

    #[test]
    fn linetype_cluster_present_with_canonical_autocad_defaults() {
        let r = default_registry();
        // Float scales: 1.0 default per AutoCAD 2026 spec.
        assert_eq!(r["LTSCALE"], SysvarValue::Float(1.0));
        assert_eq!(r["CELTSCALE"], SysvarValue::Float(1.0));
        // PSLTSCALE: Int 0/1, AutoCAD default is 1 (paper-space LT scaling on).
        assert_eq!(r["PSLTSCALE"], SysvarValue::Int(1));
        // String defaults: "ByLayer" / "BYLAYER" / "0" per acad.dwt.
        assert_eq!(r["CELTYPE"], SysvarValue::String("ByLayer".into()));
        assert_eq!(r["CECOLOR"], SysvarValue::String("BYLAYER".into()));
        assert_eq!(r["CLAYER"], SysvarValue::String("0".into()));
        // CELWEIGHT: Int enum. AutoCAD encodes ByLayer as -1.
        assert_eq!(r["CELWEIGHT"], SysvarValue::Int(-1));
    }

    #[test]
    fn full_registry_count_after_s4_a_is_twenty_five() {
        let r = default_registry();
        // 8 pre-S4 + 10 Snap/Grid + 7 Linetype = 25.
        assert_eq!(r.len(), 25);
    }
}
