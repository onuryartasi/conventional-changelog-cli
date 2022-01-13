'use strict'
const config = require('conventional-changelog-conventionalcommits');

module.exports = config({
    "preset": "angular",
    "types": [
        { type: 'feat', section: 'Features' },
        { type: 'fix', section: 'Bug Fixes' },
        { type: 'refactor', section: 'Refactors' },
    ]
})

