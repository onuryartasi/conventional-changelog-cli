



module.exports = function getRepository() {
    let owner,repo;
    if(process.env.BUILD_REPOSITORY_NAME) {
        const repository = process.env.BUILD_REPOSITORY_NAME.split('/');
        repo = repository[1]
        owner = repository[0]
        return {
            owner,
            repo
        }
    }else if (process.env.GITHUB_REPOSITORY){
        const repository = process.env.GITHUB_REPOSITORY.split('/');
        console.log(repository)
        owner = repository[0]
        repo = repository[1]
        return {
            owner,
            repo
        }
    }

}

