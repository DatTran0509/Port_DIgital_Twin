/* ──────────────────────────────────────────────────────────────────────────
 * sim/impact.js — Lightweight cascade / KPI model (Phase 2)
 *
 * NOT a physics model — a flow-network recurrence tuned so a disruption produces
 * a PLAUSIBLE, clearly DIVERGENT timeline against the undisturbed baseline. The
 * fork controller runs simulate() twice (baseline = no events, forked = with the
 * scenario's events) and charts the two series side by side.
 *
 * Propagation chain (per simulated minute):
 *   stress events → crane / gate / power CAPACITY drops
 *   crane slow    → vessel wait ↑  &  yard fill ↑  (dwell backlog)
 *   yard full     → gate service ↓ → gate queue ↑
 *   queue / wait  → cost (demurrage + idling) ↑  &  CO₂ ↑  &  ESG ↓
 * ────────────────────────────────────────────────────────────────────────── */

export const HORIZON = 60;             // minutes simulated per fork

const BASE = { wait: 0.4, yard: 62, queue: 3, power: 100, co2: 0, esg: 84, cost: 0, thru: 100 };

// Resolve the active capacity reductions at minute `m` from the event list.
function stressAt(events, m) {
  let craneCap = 100, gateCap = 100, power = 100, extraVessels = 0, jit = false;
  for (const ev of events) {
    if (ev.t > m) continue;
    switch (ev.type) {
      case 'crane_fail':      craneCap -= 55; break;
      case 'crane_reassign':  craneCap += 35; break;          // mitigation (partial)
      case 'gate_cyber':
      case 'gate_slowdown':   gateCap = Math.min(gateCap, 33); break;
      case 'gate_restore':    gateCap = 100; break;
      case 'power_outage':    power -= 60; break;
      case 'power_renew':     power += 45; break;              // renewables pick up load
      case 'sea_level':       if (ev.value >= 1.6) power -= 30; break;  // basement substation floods
      case 'storm':           craneCap = Math.min(craneCap, 20); break; // STS stop above wind limit
      case 'fire':            craneCap -= 30; gateCap -= 20; break;
      case 'vessel_surge':    extraVessels += (ev.count || 3); break;
      case 'jit_speed':       jit = true; break;               // mitigation for surge
    }
  }
  craneCap = Math.max(0, Math.min(100, craneCap));
  gateCap = Math.max(0, Math.min(100, gateCap));
  power = Math.max(0, Math.min(100, power));
  return { craneCap, gateCap, power, extraVessels, jit };
}

// Run the whole horizon, returning a per-minute series of KPI snapshots.
export function simulate(events) {
  const s = { ...BASE };
  const steps = [];
  for (let m = 0; m <= HORIZON; m++) {
    const st = stressAt(events, m);
    const craneEff = st.craneCap * st.power / 100;
    const gateEff = st.gateCap * (st.power < 40 ? 0.5 : 1);

    const surgeWait = st.extraVessels * (st.jit ? 0.05 : 0.45);
    const targetWait = BASE.wait + (100 - craneEff) / 100 * 4.2 + surgeWait;
    s.wait += (targetWait - s.wait) * 0.22;

    // Dwell backlog: a slowed crane lets the yard fill ~2 %/min (baseline drains).
    s.yard += (100 - craneEff) / 100 * 2.0 - 0.2;
    s.yard = Math.max(40, Math.min(100, s.yard));

    // Gate service degrades SMOOTHLY as the yard congests (>78%) and as gate
    // capacity drops — so a crane failure cascades to the gate queue, not just a
    // cliff at 92%. This makes every scenario visibly diverge on the chart.
    const cong = Math.max(0, (s.yard - 78) / 22);
    const svc = gateEff / 100 * Math.max(0.3, 1 - cong * 0.7);
    s.queue += (1 - svc) * 1.7 - 0.18;
    s.queue = Math.max(0, Math.min(60, s.queue));

    s.power = st.power;
    s.thru = craneEff * 0.6 + gateEff * 0.4;
    s.co2 = s.queue * 0.55 + (s.wait - BASE.wait) * 4.5 + (100 - st.power) * 0.12;
    s.esg = Math.max(28, Math.min(95, 84 - s.co2 * 0.4 - (100 - st.power) * 0.12));
    s.cost += s.wait * 900 + s.queue * 130 + (100 - st.power) * 45;

    steps.push({
      t: m, wait: s.wait, yard: s.yard, queue: s.queue, power: s.power,
      co2: s.co2, esg: s.esg, cost: s.cost, thru: s.thru,
    });
  }
  return steps;
}

// Compare two series at a given minute → signed deltas for the KPI tiles.
export function deltaAt(base, fork, m) {
  const a = base[Math.min(m, base.length - 1)], b = fork[Math.min(m, fork.length - 1)];
  return {
    wait: b.wait - a.wait,
    queue: b.queue - a.queue,
    cost: b.cost - a.cost,
    co2: b.co2 - a.co2,
    thru: b.thru - a.thru,
    esg: b.esg - a.esg,
    power: b.power - a.power,
  };
}
