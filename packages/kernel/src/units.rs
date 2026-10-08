use serde::{Deserialize, Serialize};

#[cfg(target_arch = "wasm32")]
use tsify::Tsify;

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub enum LinearUnit {
    #[default]
    Decimal,
    Engineering,
    Architectural,
    Fractional,
    Scientific,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub enum AngularUnit {
    #[default]
    DecimalDegrees,
    DMS,
    Grads,
    Radians,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct DrawingUnits {
    pub linear_type: LinearUnit,
    pub linear_precision: u8,
    pub angular_type: AngularUnit,
    pub angular_precision: u8,
    pub insertion_scale: f64,
}

impl Default for DrawingUnits {
    fn default() -> Self {
        DrawingUnits {
            linear_type: LinearUnit::Decimal,
            linear_precision: 4,
            angular_type: AngularUnit::DecimalDegrees,
            angular_precision: 2,
            insertion_scale: 1.0,
        }
    }
}

pub fn format_linear(value: f64, units: &DrawingUnits) -> String {
    let prec = units.linear_precision as usize;
    match units.linear_type {
        LinearUnit::Decimal => format!("{:.*}", prec, value),
        LinearUnit::Scientific => format!("{:.*E}", prec, value),
        LinearUnit::Engineering => {
            let feet = (value / 12.0).floor() as i64;
            let inches = value - (feet as f64 * 12.0);
            format!("{}'-{:.*}\"", feet, prec, inches)
        }
        LinearUnit::Architectural => {
            let negative = value < 0.0;
            let abs = value.abs();
            let feet = (abs / 12.0).floor() as i64;
            let remaining = abs - (feet as f64 * 12.0);
            let whole_inches = remaining.floor() as i64;
            let frac = remaining - whole_inches as f64;
            let sign = if negative { "-" } else { "" };
            if frac.abs() < 1e-6 {
                if whole_inches == 0 && feet != 0 {
                    format!("{}{}'-0\"", sign, feet)
                } else {
                    format!("{}{}'-{}\"", sign, feet, whole_inches)
                }
            } else {
                let (num, den) = closest_fraction(frac, prec);
                if whole_inches == 0 && feet != 0 {
                    format!("{}{}'-{}/{}\"", sign, feet, num, den)
                } else {
                    format!("{}{}'-{} {}/{}\"", sign, feet, whole_inches, num, den)
                }
            }
        }
        LinearUnit::Fractional => {
            let negative = value < 0.0;
            let abs = value.abs();
            let whole = abs.floor() as i64;
            let frac = abs - whole as f64;
            let sign = if negative { "-" } else { "" };
            if frac.abs() < 1e-6 {
                format!("{}{}", sign, whole)
            } else {
                let (num, den) = closest_fraction(frac, prec);
                if whole == 0 {
                    format!("{}{}/{}", sign, num, den)
                } else {
                    format!("{}{} {}/{}", sign, whole, num, den)
                }
            }
        }
    }
}

fn closest_fraction(frac: f64, precision: usize) -> (i64, i64) {
    let max_den = 1i64 << precision.clamp(1, 8);
    let num = (frac * max_den as f64).round() as i64;
    if num == 0 {
        return (0, 1);
    }
    let g = gcd(num.unsigned_abs(), max_den as u64) as i64;
    (num / g, max_den / g)
}

fn gcd(mut a: u64, mut b: u64) -> u64 {
    while b != 0 {
        let t = b;
        b = a % b;
        a = t;
    }
    a
}

pub fn format_angular(value_radians: f64, units: &DrawingUnits) -> String {
    let prec = units.angular_precision as usize;
    match units.angular_type {
        AngularUnit::DecimalDegrees => {
            let deg = value_radians.to_degrees();
            format!("{:.*}°", prec, deg)
        }
        AngularUnit::DMS => {
            let total_deg = value_radians.to_degrees();
            let negative = total_deg < 0.0;
            let total_deg = total_deg.abs();
            let d = total_deg.floor() as i64;
            let rem = (total_deg - d as f64) * 60.0;
            let m = rem.floor() as i64;
            let s = (rem - m as f64) * 60.0;
            let sign = if negative { "-" } else { "" };
            format!("{}{}°{}'{:.*}\"", sign, d, m, prec, s)
        }
        AngularUnit::Grads => {
            let grads = value_radians * 200.0 / std::f64::consts::PI;
            format!("{:.*}g", prec, grads)
        }
        AngularUnit::Radians => {
            format!("{:.*}r", prec, value_radians)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decimal_format() {
        let u = DrawingUnits::default();
        assert_eq!(format_linear(12.3456, &u), "12.3456");
        assert_eq!(format_linear(0.0, &u), "0.0000");
    }

    #[test]
    fn decimal_precision() {
        let mut u = DrawingUnits::default();
        u.linear_precision = 2;
        assert_eq!(format_linear(12.3456, &u), "12.35");
    }

    #[test]
    fn scientific_format() {
        let mut u = DrawingUnits::default();
        u.linear_type = LinearUnit::Scientific;
        u.linear_precision = 2;
        let result = format_linear(12345.0, &u);
        assert!(result.contains("E"));
    }

    #[test]
    fn engineering_format() {
        let mut u = DrawingUnits::default();
        u.linear_type = LinearUnit::Engineering;
        u.linear_precision = 2;
        assert_eq!(format_linear(30.0, &u), "2'-6.00\"");
    }

    #[test]
    fn architectural_format() {
        let mut u = DrawingUnits::default();
        u.linear_type = LinearUnit::Architectural;
        u.linear_precision = 4;
        let result = format_linear(30.0, &u);
        assert!(result.contains("2'"));
        assert!(result.contains("6"));
    }

    #[test]
    fn fractional_format() {
        let mut u = DrawingUnits::default();
        u.linear_type = LinearUnit::Fractional;
        u.linear_precision = 4;
        assert_eq!(format_linear(3.0, &u), "3");
        let result = format_linear(3.5, &u);
        assert!(result.contains("1/2"));
    }

    #[test]
    fn angular_decimal_degrees() {
        let u = DrawingUnits::default();
        let result = format_angular(std::f64::consts::FRAC_PI_2, &u);
        assert_eq!(result, "90.00°");
    }

    #[test]
    fn angular_dms() {
        let mut u = DrawingUnits::default();
        u.angular_type = AngularUnit::DMS;
        u.angular_precision = 0;
        let result = format_angular(std::f64::consts::FRAC_PI_4, &u);
        assert!(result.contains("45°"));
    }

    #[test]
    fn angular_grads() {
        let mut u = DrawingUnits::default();
        u.angular_type = AngularUnit::Grads;
        u.angular_precision = 2;
        let result = format_angular(std::f64::consts::FRAC_PI_2, &u);
        assert_eq!(result, "100.00g");
    }

    #[test]
    fn angular_radians() {
        let mut u = DrawingUnits::default();
        u.angular_type = AngularUnit::Radians;
        u.angular_precision = 4;
        let result = format_angular(std::f64::consts::PI, &u);
        assert_eq!(result, "3.1416r");
    }

    #[test]
    fn units_serialization_roundtrip() {
        let u = DrawingUnits::default();
        let json = serde_json::to_string(&u).unwrap();
        let parsed: DrawingUnits = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.linear_type, u.linear_type);
        assert_eq!(parsed.angular_type, u.angular_type);
        assert_eq!(parsed.linear_precision, u.linear_precision);
    }
}
