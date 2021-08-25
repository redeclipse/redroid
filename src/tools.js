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
    async getmember(action, user) {
        const members = await action.guild.members.fetch();
        return members.filter(m => m.user.id === user.id).first();
    },
    async randomuser(action, value) {
        let user = action.options.getUser(value);
        if (user === null || user.id === action.user.id) {
            const members = await action.guild.members.fetch();
            user = members.filter(m => m.user.id !== action.user.id).random().user;
        }
        return user;
    },
    async randommember(action, value) {
        const user = this.randomuser(action, value);
        return await this.getmember(user);
    },
    defaultuser(action, value) {
        let user = action.options.getUser(value);
        if (!user) user = action.user;
        return user;
    },
    async defaultmember(action, value) {
        const user = action.options.getUser(value);
        if (!user) return action.member;
        return await this.getmember(action, user);
    },
    async pickuser(action, value) {
        if (global.access.level(action.guild, action.user) >= 2) return await this.randomuser(action, value);
        return this.defaultuser(action, value);
    },
    async pickmember(action, value) {
        if (global.access.level(action.guild, action.user) >= 2) return await this.randommemeber(action, value);
        return await this.defaultmember(action, value);
    }
};
