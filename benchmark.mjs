import { performance } from 'perf_hooks';

// Setup mock data
const barbers = Array.from({ length: 20 }, (_, i) => ({ id: `barber_${i}`, name: `Barber ${i}` }));
const tickets = Array.from({ length: 5000 }, (_, i) => ({
    id: `ticket_${i}`,
    status: i % 3 === 0 ? 'serving' : (i % 3 === 1 ? 'waiting' : 'completed'),
    barber_id: `barber_${i % 20}`,
    ticket_number: i
}));

function getBarberIndex(barberId) {
    if (!barberId) return -1;
    return barbers.findIndex(b => b.id === barberId);
}

const activeTickets = tickets.filter(t => t.status === 'waiting' || t.status === 'serving');

// Baseline
const startBaseline = performance.now();
let resultBaseline = 0;
for (let i = 0; i < 100; i++) {
    const renderArray = activeTickets.map((t) => {
        const barber = barbers.find(b => b.id === t.barber_id);
        const barberIndex = getBarberIndex(barber?.id);
        return { barberName: barber?.name, barberIndex };
    });
    resultBaseline += renderArray.length;
}
const endBaseline = performance.now();
const baselineMs = endBaseline - startBaseline;

// Optimized
const startOptimized = performance.now();
let resultOptimized = 0;
for (let i = 0; i < 100; i++) {
    const barberMap = new Map(barbers.map((b, idx) => [b.id, { barber: b, index: idx }]));
    const renderArray = activeTickets.map((t) => {
        const mapped = barberMap.get(t.barber_id || '');
        const barber = mapped?.barber;
        const barberIndex = mapped?.index ?? -1;
        return { barberName: barber?.name, barberIndex };
    });
    resultOptimized += renderArray.length;
}
const endOptimized = performance.now();
const optimizedMs = endOptimized - startOptimized;

console.log(`Baseline: ${baselineMs.toFixed(2)} ms`);
console.log(`Optimized: ${optimizedMs.toFixed(2)} ms`);
console.log(`Improvement: ${((baselineMs - optimizedMs) / baselineMs * 100).toFixed(2)}%`);
