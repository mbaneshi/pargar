// Snippet of NexusWorld for sysvar registry testing.
impl NexusWorld {
    fn default_sysvars() -> HashMap<String, f64> {
        let mut m = HashMap::new();
        m.insert("OFFSETDIST".into(), 0.0);
        m.insert("FILLETRAD".into(), 0.0);
        m.insert("TRIMMODE".into(), 1.0);
        m.insert("CHAMFERA".into(), 0.0);
        m
    }

    pub fn get_sysvar(&self, name: &str) -> f64 {
        self.sysvars.get(name).copied().unwrap_or(0.0)
    }
}
