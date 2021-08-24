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
    }
};
