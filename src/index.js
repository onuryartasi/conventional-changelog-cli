const core = require('@actions/core')
const conventionalRecommendedBump = require('conventional-recommended-bump')
const path = require('path')

const getVersioning = require('./version')
const changelog = require('./helpers/generateChangelog')
const requireScript = require('./helpers/requireScript')
const { Command } = require('commander');
const program = new Command();
program.version('0.0.1');

async function handleVersioningByExtension(ext, file, versionPath, releaseType) {
  const versioning = getVersioning(ext)

  // File type not supported
  if (versioning === null) {
    throw new Error(`File extension "${ext}" from file "${file}" is not supported`)
  }

  versioning.init(path.resolve(process.cwd(), file), versionPath)

  // Bump the version in the package.json
  await versioning.bump(releaseType)

  return versioning
}

async function run() {
  try {

    program
    .option('--git-message <message>','Commit message to use','chore(release): {version}')
    .option('--git-user-name <name>','The git user.name to use for the commit','github-actions[bot]')
    .option('--git-user-email <email>','The git user.email to use for the commit','41898282+github-actions[bot]@users.noreply.github.com')   
    .option('--tag-prefix <prefix','Prefix that is used for the git tag','v')
    .option('--git-pull-method <method>','The git pull method used when pulling all changes from remote','--ff-only')
    .option('--preset <preset>','The preset from Conventional Changelog to use','angular') 
    .option('--pre-commit <commit>','Path to the pre-commit script file')
    .option('--output-file <outpu>','File to output the changelog to','CHANGELOG.md')
    .option('--release-count <count>','Number of releases to preserve in changelog','5') 
    .option('--version-file <file>','The path to the file that contains the version to bump (supports comma-separated list of file paths)','./package.json')
    .option('--version-path <path>','The place inside the version file to bump','version')
    .option('--skip-version-file',"Don't update version file",false) 
    .option('--skip-on-empty','Do nothing when the changelog from the latest release is empty',true) 
    .option('--skip-commit','Do create a release commit',false) 
    .option('--skip-on-empty')
    .option('--commit-path <path>','The path to the package','./') 
    .option('--config-file-path <path>','Path to the conventional changelog config file. If set, the preset setting will be ignored')
    .option('--pre-changelog-generation <path>','Path to the pre-changelog-generation script file')
    .option('--fallback-version',"fallback version","0.1.0")
    .parse()

    const parameters = program.opts();
    console.log(parameters)
    const gitCommitMessage = parameters.gitMessage
    const gitUserName = parameters.gitUserName
    const gitUserEmail = parameters.gitUserEmail
    const tagPrefix = parameters.tagPrefix
    
    const preset = !parameters.configFilePath ? parameters.preset : ''

    const preCommitFile = parameters.preCommit
    const outputFile = parameters.outputFile
    const releaseCount = parameters.releaseCount
    const versionFile = parameters.versionFile
    const versionPath = parameters.versionPath
    const skipVersionFile = parameters.skipVersionFile
    const skipCommit = parameters.skipCommit
    const skipEmptyRelease = parameters.skipOnEmpty
    const conventionalConfigFile = parameters.configFilePath
    const commitPath = parameters.commitPath
    const preChangelogGenerationFile = parameters.preChangelogGeneration

    console.log(`Using "${preset}" preset`)
    console.log(`Using "${gitCommitMessage}" as commit message`)
    console.log(`Using "${gitUserName}" as git user.name`)
    console.log(`Using "${gitUserEmail}" as git user.email`)
    console.log(`Using "${releaseCount}" release count`)
    console.log(`Using "${versionFile}" as version file`)
    console.log(`Using "${versionPath}" as version path`)
    console.log(`Using "${tagPrefix}" as tag prefix`)
    console.log(`Using "${commitPath}" as CommitPath`)
    console.log(`Using "${outputFile}" as output file`)
    console.log(`Using "${conventionalConfigFile}" as config file`)

    if (preCommitFile) {
      console.log(`Using "${preCommitFile}" as pre-commit script`)
    }

    if (preChangelogGenerationFile) {
      console.log(`Using "${preChangelogGenerationFile}" as pre-changelog-generation script`)
    }

    console.log(`Skipping empty releases is "${skipEmptyRelease ? 'enabled' : 'disabled'}"`)
    console.log(`Skipping the update of the version file is "${skipVersionFile ? 'enabled' : 'disabled'}"`)

    const config = conventionalConfigFile && requireScript(preChangelogGenerationFile)
    const gitRawCommitsOpts = {}
    const options = {
      preset,
      tagPrefix,
      config,
    }
    if (commitPath) {
      gitRawCommitsOpts.path = commitPath
      options.path = commitPath
    }


    conventionalRecommendedBump(options, async(error, recommendation) => {
      if (error) {
        console.log(new Error(error.message))
        return
      }

     console.log(`Recommended release type: ${recommendation.releaseType}`)

      // If we have a reason also log it
      if (recommendation.reason) {
        console.log(`Because: ${recommendation.reason}`)
      }

      let newVersion

      // If skipVersionFile or skipCommit is true we use GIT to determine the new version because
      // skipVersionFile can mean there is no version file and skipCommit can mean that the user
      // is only interested in tags
      if (skipVersionFile || skipCommit) {
        console.log('Using GIT to determine the new version')
        const versioning = await handleVersioningByExtension(
          'git',
          versionFile,
          versionPath,
          recommendation.releaseType,
        )

        newVersion = versioning.newVersion

      } else {
        const files = versionFile.split(',').map((f) => f.trim())
        console.log(`Files to bump: ${files.join(', ')}`)

        const versioning = await Promise.all(
          files.map((file) => {
            const fileExtension = file.split('.').pop()
            console.log(`Bumping version to file "${file}" with extension "${fileExtension}"`)

            return handleVersioningByExtension(fileExtension, file, versionPath, recommendation.releaseType)
          }),
        )

        newVersion = versioning[0].newVersion
      }

      let gitTag = `${tagPrefix}${newVersion}`

      if (preChangelogGenerationFile) {
        const preChangelogGenerationScript = requireScript(preChangelogGenerationFile)

        // Double check if we want to update / do something with the tag
        if (preChangelogGenerationScript && preChangelogGenerationScript.preTagGeneration) {
          const modifiedTag = await preChangelogGenerationScript.preTagGeneration(gitTag)

          if (modifiedTag) {
            console.log(`Using modified tag "${modifiedTag}"`)
            gitTag = modifiedTag
          }
        }
      }

      // Generate the string changelog
      const stringChangelog = await changelog.generateStringChangelog(tagPrefix, preset, newVersion, 1,gitRawCommitsOpts, config)
      console.log('Changelog generated')
      console.log(stringChangelog)

      // Removes the version number from the changelog
      const cleanChangelog = stringChangelog.split('\n').slice(3).join('\n').trim()

      if (skipEmptyRelease && cleanChangelog === '') {
        console.log('Generated changelog is empty and skip-on-empty has been activated so we skip this step')
        console.log('skipped', 'true')
        console.log("Commits not found about this package.")
        return
      }

      console.log(`New version: ${newVersion}`)

      // If output file === 'false' we don't write it to file
      if (outputFile !== 'false') {
        // Generate the changelog
        await changelog.generateFileChangelog(tagPrefix, preset, newVersion, outputFile, releaseCount, gitRawCommitsOpts,config)
      }

      if (!skipCommit) {
        // Add changed files to git
        if (preCommitFile) {
          const preCommitScript = requireScript(preCommitFile)

          // Double check if the file exists and the export exists
          if (preCommitScript && preCommitScript.preCommit) {
            await preCommitScript.preCommit({
              tag: gitTag,
              version: newVersion,
            })
          }
        }

        //await git.add('.')
        //await git.commit(gitCommitMessage.replace('{version}', gitTag))
      }

      // Create the new tag
      //await git.createTag(gitTag)

      // core.info('Push all changes')
      // try {
      //   //await git.push()
      // } catch (error){
      //   core.setFailed(`We occured error when pushing code: ${error.message}`)
      // }
     
      // Set outputs so other actions (for example actions/create-release) can use it
      console.log('changelog', stringChangelog)
      console.log('clean_changelog', cleanChangelog)
      console.log('version', newVersion)
      console.log('tag', gitTag)
      console.log('skipped', 'false')

    })
  } catch (error) {
    core.setFailed(error)
  }
}

run()