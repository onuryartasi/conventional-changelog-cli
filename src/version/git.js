const gitSemverTags = require('git-semver-tags')

const BaseVersioning = require('./base')
const bumpVersion = require('../helpers/bumpVersion')

module.exports = class Git extends BaseVersioning {

  bump = (releaseType,tagPrefix) => {
    return new Promise((resolve) => {

      gitSemverTags({
        tagPrefix,
      }, async(err, tags) => {
        const currentVersion = tags.length > 0 ? tags.shift().replace(tagPrefix, '') : null

        // Get the new version
        this.newVersion = await bumpVersion(
          releaseType,
          currentVersion,
          
        )

        // We are done
        resolve()
      })
    })
  }

  getVersion = (releaseType,tagPrefix) => {
    return new Promise((resolve) => {

      gitSemverTags({
        tagPrefix,
      }, async(err, tags) => {
        const currentVersion = tags.length > 0 ? tags.shift().replace(tagPrefix, '') : null

        // Get the new version
        this.newVersion = await bumpVersion(
          releaseType,
          currentVersion,
          
        )

        // We are done
        resolve()
      })
    })
  }

}
