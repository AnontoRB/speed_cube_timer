use wasm_bindgen::prelude::*;

fn rnd(n: usize) -> usize {
    (js_sys::Math::random() * n as f64) as usize
}
fn pick<'a>(a: &[&'a str]) -> &'a str {
    a[rnd(a.len())]
}

/// Scramble for "2", "3", "4", "5" or "oh" (OH uses a 3x3 scramble).
#[wasm_bindgen]
pub fn scramble(ev: &str) -> String {
    let (n, len) = match ev {
        "2" => (2, 9),
        "4" => (4, 40),
        "5" => (5, 60),
        _ => (3, 20),
    };
    let faces: &[u8] = if n == 2 { &b"URF"[..] } else { &b"URFDLB"[..] };
    let mut out: Vec<String> = Vec::new();
    let mut last = usize::MAX;
    while out.len() < len {
        let f = rnd(faces.len());
        let axis = f % 3; // never turn the same axis twice in a row
        if axis == last {
            continue;
        }
        last = axis;
        let mut m = (faces[f] as char).to_string();
        if n > 3 && rnd(2) == 1 {
            m.push('w');
        }
        m.push_str(pick(&["", "'", "2"]));
        out.push(m);
    }
    out.join(" ")
}

/// Format milliseconds (truncated, like the WCA does). Infinity = DNF.
#[wasm_bindgen]
pub fn fmt(ms: f64, dec: u8) -> String {
    if !ms.is_finite() {
        return "DNF".into();
    }
    let d: usize = if dec == 3 { 3 } else { 2 };
    let (unit, den) = if d == 3 { (1.0, 1000.0) } else { (10.0, 100.0) };
    let s = (ms / unit).floor() / den;
    if s >= 60.0 {
        let m = (s / 60.0).floor();
        format!("{}:{:0w$.p$}", m as u32, s - m * 60.0, w = d + 3, p = d)
    } else {
        format!("{:.p$}", s, p = d)
    }
}

/// Average of 5: drop best and worst, two or more DNFs = DNF. NaN if < 5 solves.
#[wasm_bindgen]
pub fn ao5(v: &[f64]) -> f64 {
    if v.len() < 5 {
        return f64::NAN;
    }
    if v.iter().filter(|x| x.is_infinite()).count() > 1 {
        return f64::INFINITY;
    }
    let mut s = v.to_vec();
    s.sort_by(|a, b| a.total_cmp(b));
    (s[1] + s[2] + s[3]) / 3.0
}

/// [best, mean, current ao5, best ao5]; NaN where not available.
#[wasm_bindgen]
pub fn stats(v: &[f64]) -> Vec<f64> {
    let fin: Vec<f64> = v.iter().cloned().filter(|x| x.is_finite()).collect();
    let best = fin.iter().cloned().fold(f64::NAN, f64::min);
    let mean = if fin.is_empty() { f64::NAN } else { fin.iter().sum::<f64>() / fin.len() as f64 };
    let cur = if v.len() >= 5 { ao5(&v[v.len() - 5..]) } else { f64::NAN };
    let bao = v.windows(5).map(ao5).fold(f64::NAN, f64::min);
    vec![best, mean, cur, bao]
}

/// Inspection penalty: 0 = fine, 2 = +2 (15-17 s), -1 = DNF (17 s or more).
#[wasm_bindgen]
pub fn insp(sec: f64) -> i8 {
    if sec >= 17.0 { -1 } else if sec > 15.0 { 2 } else { 0 }
}

#[wasm_bindgen]
pub fn insp_text(sec: f64) -> String {
    if sec < 15.0 { format!("{}", (15.0 - sec).ceil() as i32) } else { "+2".into() }
}
