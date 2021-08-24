module.exports = {
    level(guild, user) {
        const member = guild.members.resolve(user);
        switch (guild.id) {
            case '224638962050793474': {
                if (member.id === '189189124194959361' || member.id === '854993935831138323') return 10;
                if (member.roles.cache.find(r => r.name === 'Developers')) return 6;
                if (member.roles.cache.find(r => r.name === 'Administrators')) return 5;
                if (member.roles.cache.find(r => r.name === 'Moderators')) return 4;
                if (member.roles.cache.find(r => r.name === 'Supporters')) return 3;
                if (member.roles.cache.find(r => r.name === 'Speshul')) return 2;
                if (member.roles.cache.find(r => r.name === 'Team Alpha') || member.roles.cache.find(r => r.name === 'Team Omega')) return 1;
                break;
            }
            default: break;
        }
        return 0;
    }
};
