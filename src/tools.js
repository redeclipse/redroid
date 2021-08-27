module.exports = {
    name: 'tools',
    start() {
        return true;
    },

    // Maths
    rand(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    },

    // Strings
    strtoregex(str) {
        const args = str.match(/^\/(.*?)\/([gimsuy]*)$/);
        return args ? new RegExp(args[1], args[2]) : new RegExp(str, 'i');
    },

    // Users / Members
    getmember(action, user) {
        const members = action.guild.members.fetch();
        return members.filter(m => m.user.id === user.id).first();
    },
    randomuser(action, value) {
        let user = action.options.getUser(value);
        if (!user) {
            const members = action.guild.members.fetch();
            user = members.filter(m => m.user.id !== action.user.id).random().user;
        }
        return user;
    },
    randommember(action, value) {
        const user = this.randomuser(action, value);
        return this.getmember(user);
    },
    defaultuser(action, value) {
        let user = action.options.getUser(value);
        if (!user) user = action.user;
        return user;
    },
    defaultmember(action, value) {
        const user = action.options.getUser(value);
        if (!user) return action.member;
        return this.getmember(action, user);
    },
    pickuser(action, value) {
        if (global.access.level(action.guild, action.user) >= 2) return this.randomuser(action, value);
        return this.defaultuser(action, value);
    },
    pickmember(action, value) {
        if (global.access.level(action.guild, action.user) >= 2) return this.randommemeber(action, value);
        return this.defaultmember(action, value);
    },

    // Command helpers
    subcommands(config) {
        let result = '';
        for (const value of config.chat.options) {
            result += value.name;
        }
        return result;
    },

};
