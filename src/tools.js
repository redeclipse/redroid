module.exports = {
    init() {
        return true;
    },
    rand(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }
};
