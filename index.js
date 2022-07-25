/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */

const RECOMMENDATION = "0.15.1"

module.exports = (app) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  app.on(["issues.opened", "issues.reopened"], async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    console.log("detected issue opened")
    return context.octokit.issues.createComment(issueComment);
  });

  app.on(["pull_request.opened", "pull_request.reopened", "pull_request.edited"], async (context) => {
    const owner = context.payload.repository.owner.login
    const repo = context.payload.repository.name
    const number = context.payload.number
    const body = "hello"
    const sha = context.payload.pull_request.head.sha
    const files = await context.octokit.rest.pulls.listFiles({
      owner: owner, 
      repo: repo, 
      pull_number: number
    })

    // looking for snapshot versions
    for (let file of files.data) {
      if (file.filename == "pom.xml") {
        var snapshotLines = getSnapshotLines(file.patch)
      }
    }

    var snapshotCommentTemplate = {
      owner: owner, 
      repo: repo,
      pull_number: number,
      body: "",
      path: "pom.xml",
      commit_id: sha,
      position: position,
    }

    publishComments(context, snapshotCommentTemplate, snapshotLines)

    // console.log(files)
    for (let file of files.data) {
      if (file.filename == "pom.xml") {
        var versionAndLine = getVersionAndLine(file.patch);
        console.log(versionAndLine)

        var version = versionAndLine[0]
        var position = versionAndLine[1]
        var filename = file.filename
        var needs_update = doesItNeedUpdate(version, RECOMMENDATION)
      }
    }

    if (needs_update) {
      var strcomment = "Hey " + owner +
        " 👋, thanks for the PR !!! You are awesome. \n" +
        "Pretty please update from version `" + version + "` to version `" +
        RECOMMENDATION + "`\n" +
        "🙏🙏🙏"
    } else {
      var strcomment = "Your version [`" + version + "`] is good enough for us. 💪 💯"
    }

    const comment = {
      owner: owner, 
      repo: repo,
      pull_number: number,
      body: strcomment,
      path: filename,
      commit_id: sha,
      position: position,
    };
  
    return context.octokit.pulls.createReviewComment(comment);

  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};

function publishComments(context, snapshotCommentTemplate, snapshotLines) {
  if (snapshotLines.length == 0) {
    const comment = context.issue({
      body: "All dependencies are good! 💪 💯"
    })
    context.octokit.issues.createComment(comment);
  } else {
    for (let line in snapshotLines) {
      snapshotCommentTemplate.position = snapshotLines[line]
      snapshotCommentTemplate.body = "Hey " + snapshotCommentTemplate.owner +
        " 👋, thanks for the PR !!! You are awesome. \n" +
        "Please remove the SNAPSHOT tag from the version 🙏🙏🙏."

      context.octokit.pulls.createReviewComment(snapshotCommentTemplate)
    }
  }
}

function hasSnapshotVersion(line) {
  var patternRegex = /<version>(.*?)<\/version>/g
  var matches = line.matchAll(patternRegex)
  let next = matches.next()
  if (!next.done) {
    version = next.value[1]
    return version.includes("SNAPSHOT")
  }
  return false
}

function getSnapshotLines(diff) {
  const lines = diff.split("\n")
  var i = 1
  var snapshotLines = []
  
  while (i < lines.length) {
    let line = lines[i]
    if (hasSnapshotVersion(line)) {
      console.log("Uh oh, found a snapshot - line " + i)
      snapshotLines.push(i)
    }
    i++
  }
  return snapshotLines
}

// make a general comment
// const comment = context.issue({
//   body: strcomment
// })
// // console.log("Comment is: ")
// console.log(comment)
// console.log("======================\n\n")
// return context.octokit.issues.createComment(comment);

function getVersionAndLine(diff) {
  var patternRegex = /<version>(.*?)<\/version>/g;
  // var matches = diff.matchAll(patternRegex);
  
  // let result = matches.next();
  // while (!result.done) {
  //   console.log("> " +result.value[1])
  //   var version = result.value[1];
  //   result = matches.next()
  // }
  var position = 0
  var version = ""

  let lines = diff.split("\n")
  var i = 1
  while (i <= lines.length) {
    let line = lines[i]
    console.log(line)

    var matches = line.matchAll(patternRegex)
    let next = matches.next()
    if (!next.done) {
      console.log("found version line!")
      position = i
      version = next.value[1]
      break
    }
    i++
  }
  return [version, position]
}

function doesItNeedUpdate(current, recommended) {
  console.log("current " + current)
  let splitsCurrent = current.split(".")
  let splitsRecommended = recommended.split(".")

  for (let i=0; i <3; i++) {
    console.log("current: ",parseInt(splitsCurrent[i]))
    console.log("recommended: ",parseInt(splitsRecommended[i]))

    if (parseInt(splitsCurrent[i]) < parseInt(splitsRecommended[i]))
      return true
    else if (parseInt(splitsCurrent[i]) > parseInt(splitsRecommended[i]))
      return false
  }
  return false
}