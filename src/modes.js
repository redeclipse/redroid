// A match's mode and mutators as the website's server browser reads them, by the game protocol (gameversion) they apply from:
// each entry inherits whatever it leaves out, gsp (the game specific mutators, which take the bits straight after the named
// ones) merged by mode id, and implied the mutators a mode always has, which aren't shown
const CHANGES = [
    { from: 0, // 1.2
        modes: ['Demo', 'Editing', 'Campaign', 'Deathmatch', 'Capture the Flag', 'Defend the Flag', 'Bomber Ball', 'Time Trial'],
        mutators: ['Multi', 'Team', 'Instagib', 'Medieval', 'Ballistic', 'Duel', 'Survivor', 'Arena', 'Onslaught', 'Hover', 'Jetpack', 'Vampire', 'Expert', 'Resize'],
        gsp: { 4: ['Return', 'Defend', 'Protect'], 5: ['Quick', 'Conquer'], 6: ['Basket', 'Hold'] },
        implied: { 2: ['Team'], 4: ['Team'], 5: ['Team'], 6: ['Team'] } },
    { from: 217, // 1.3
        modes: ['Demo', 'Editing', 'Deathmatch', 'Capture the Flag', 'Defend the Flag', 'Bomber Ball', 'Time Trial'],
        mutators: ['Multi', 'Team', 'Coop', 'Instagib', 'Medieval', 'Ballistic', 'Duel', 'Survivor', 'Arena', 'Onslaught', 'Jetpack', 'Vampire', 'Expert', 'Resize'],
        gsp: { 3: ['Return', 'Defend', 'Protect'], 4: ['Quick', 'Conquer', 'King'], 5: ['Hold'], 6: [] },
        implied: { 3: ['Team'], 4: ['Team'], 5: ['Team'] } },
    { from: 220, // 1.4
        modes: ['Demo', 'Editing', 'Deathmatch', 'Capture the Flag', 'Defend the Flag', 'Bomber Ball', 'Time Trial', 'Gauntlet'],
        mutators: ['Multi', 'Free for All', 'Coop', 'Instagib', 'Medieval', 'Kaboom', 'Duel', 'Survivor', 'Classic', 'Onslaught', 'Jetpack', 'Vampire', 'Expert', 'Resize'],
        gsp: { 3: ['Quick', 'Defend', 'Protect'], 4: ['Quick', 'King'], 5: ['Hold', 'Touchdown'], 7: ['Timed', 'Hard'] },
        implied: { 1: ['Free for All', 'Classic'] } },
    { from: 226, // 1.5
        modes: ['Demo', 'Editing', 'Deathmatch', 'Capture the Flag', 'Defend and Control', 'Bomber Ball', 'Race'],
        mutators: ['Multi', 'Free for All', 'Coop', 'Instagib', 'Medieval', 'Kaboom', 'Duel', 'Survivor', 'Classic', 'Onslaught', 'Freestyle', 'Vampire', 'Resize', 'Hard', 'Basic'],
        gsp: { 3: ['Quick', 'Defend', 'Protect'], 4: ['Quick', 'King'], 5: ['Hold', 'Basket', 'Attack'], 6: ['Timed', 'Endurance', 'Gauntlet'], 7: [] } },
    { from: 228, gsp: { 2: ['Gladiator', 'Old School'] } }, // 1.6 is 230
    { from: 236, gsp: { 5: ['Hold', 'Basket', 'Assault'] } },
    { from: 238, implied: { 1: ['Free for All'] } },
    { from: 242, mutators: ['Multi', 'Free for All', 'Coop', 'Instagib', 'Medieval', 'Kaboom', 'Duel', 'Survivor', 'Classic', 'Onslaught', 'Freestyle', 'Vampire', 'Resize', 'Hard', 'Arena'] },
    { from: 244, mutators: ['Multi', 'Free for All', 'Coop', 'Instagib', 'Medieval', 'Kaboom', 'Duel', 'Survivor', 'Classic', 'Onslaught', 'Vampire', 'Resize', 'Hard', 'Arena'] },
    { from: 245, // 2.0
        mutators: ['Free for All', 'Coop', 'Instagib', 'Medieval', 'Kaboom', 'Duel', 'Survivor', 'Classic', 'Onslaught', 'Vampire', 'Resize', 'Hard', 'Arena'],
        gsp: { 6: ['Lapped', 'Endurance', 'Gauntlet'] } },
    { from: 270, mutators: ['Free for All', 'Coop', 'Instagib', 'Medieval', 'Kaboom', 'Duel', 'Survivor', 'Classic', 'Onslaught', 'Vampire', 'Resize', 'Hard', 'Arena', 'Dark'] },
    { from: 274, implied: { 1: ['Free for All', 'Arena'] } },
    { from: 278, modes: ['Demo', 'Editing', 'Deathmatch', 'Capture the Flag', 'Defend and Control', 'Bomber Ball', 'Speedrun'] }
];
const LAYOUTS = [];
for (const c of CHANGES) {
    const cur = LAYOUTS[LAYOUTS.length - 1] || {};
    const next = Object.assign({}, cur, c);
    if (c.gsp) next.gsp = Object.assign({}, cur.gsp, c.gsp);
    LAYOUTS.push(next);
}
// The game's icons for them, by its texture names; whatever has none is named in words only
const MODEICONS = { 'Demo': 'demo', 'Editing': 'editing', 'Deathmatch': 'deathmatch', 'Capture the Flag': 'capture', 'Defend the Flag': 'defend',
    'Defend and Control': 'defend', 'Bomber Ball': 'bomber', 'Time Trial': 'speedrun', 'Race': 'speedrun', 'Speedrun': 'speedrun' };
// Mode specific mutators are named for their mode, as Quick means something different in each, except Deathmatch's
const MUTATORICONS = ['arena', 'classic', 'coop', 'dark', 'duel', 'ffa', 'hard', 'instagib', 'kaboom', 'medieval', 'onslaught', 'resize', 'survivor', 'vampire',
    'gladiator', 'oldschool', 'capturequick', 'capturedefend', 'captureprotect', 'defendquick', 'defendking',
    'bomberhold', 'bomberbasket', 'bomberassault', 'speedrunlapped', 'speedrunendurance', 'speedrungauntlet'];

const own = (t, i) => t && Object.prototype.hasOwnProperty.call(t, i) ? t[i] : undefined;
const slug = name => {
    const s = name.toLowerCase().replace(/[^a-z]/g, '');
    return s === 'freeforall' ? 'ffa' : s;
};

module.exports = {
    start() {
        return false;
    },
    // The layout for a game protocol, the newest when it isn't known
    layout(v) {
        if (typeof v !== 'number') return LAYOUTS[LAYOUTS.length - 1];
        for (let i = LAYOUTS.length - 1; i > 0; i--) if (v >= LAYOUTS[i].from) return LAYOUTS[i];
        return LAYOUTS[0];
    },
    // { gameversion, modeid, mutators } as the mode, then its mutators less those the mode implies, each with its icon or null
    parts(st) {
        const l = this.layout(st.gameversion), name = own(l.modes, st.modeid) || `Mode ${st.modeid}`;
        const gsp = own(l.gsp, st.modeid) || [], implied = own(l.implied, st.modeid) || [], mode = own(MODEICONS, name) || null;
        const parts = [{ name, icon: mode }];
        const bits = typeof st.mutators === 'number' ? st.mutators : 0;
        for (let i = 0; i < 31; i++) {
            if (!(bits & (1 << i))) continue;
            const specific = i >= l.mutators.length, m = specific ? gsp[i - l.mutators.length] : l.mutators[i];
            if (!m || implied.includes(m)) continue;
            const file = (specific && mode !== 'deathmatch' ? mode : '') + slug(m);
            parts.push({ name: m, icon: MUTATORICONS.includes(file) ? file : null });
        }
        return parts;
    },
    name(st) {
        return own(this.layout(st.gameversion).modes, st.modeid) || null;
    },
    // The mode's and mutators' icon emoji, to go before the mode's name
    icons(st) {
        return global.emoji.icons(this.parts(st).map(p => p.icon).filter(Boolean));
    }
};
