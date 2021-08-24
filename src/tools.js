module.exports = {
    name: 'tools',
    start() {
        return true;
    },
    rand(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    },
    async randomuser(action, value) {
        let user = action.options.getUser(value);
        if (user === null || user.id === action.user.id) {
            const members = await action.guild.members.fetch();
            user = members.filter(m => m.user.id !== action.user.id).random().user;
        }
        return user;
    },
    defaultuser(action, value) {
        let user = action.options.getUser(value);
        if (!user) user = action.user;
        return user;
    },
    pickuser(action, value) {
        if (global.access.level(action.guild, action.user) >= 2) return this.randomuser(action, value);
        return this.defaultuser(action, value);
    },
    strtoregex(str) {
        const args = str.match(/^\/(.*?)\/([gimsuy]*)$/);
        return args ? new RegExp(args[1], args[2]) : new RegExp(str);
    }
};
