///////////////////
// NODE PACKAGES //
///////////////////

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");



///////////////////
// EXPRESS SETUP //
///////////////////

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));



////////////////////
// PASSPORT SETUP //
////////////////////

app.use(session({
  secret: "QIRVwQaseS",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());



////////////////////
// DATABASE SETUP //
////////////////////

mongoose.connect(
  "mongodb://localhost:27017/forumDB",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
  }
);

const answerSchema = {
  body: String,
  authorId: String,
  authorName: String,
  dateString: String,
  rating: Number,
  usersUpvoted: [String],
  usersDownvoted: [String]
};

const Answer = new mongoose.model("Answer", answerSchema);

const questionSchema = {
  title: String,
  body: String,
  authorId: String,
  authorName: String,
  dateString: String,
  deltaTimeString: String,
  milliseconds: Number,
  reportCount: Number,
  answerCount: Number,
  edited: Boolean,
  isAnonymous: Boolean,
  tags: [String],
  usersReported: [String],
  answers: [answerSchema]
};

const Question = new mongoose.model("Question", questionSchema);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  dateString: String,
  bio: String,
  questions: [String],
  answers: [String],
  anonymousCount: Number,
  status: Number
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());



///////////////////////////
// CONSTANTS & FUNCTIONS //
///////////////////////////

const months = [
  "Jan", "Feb", "Mar",
  "Apr", "May", "Jun",
  "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec"
];
function generateDeltaTimeString(ms) {
  var deltaTimeString;
  if (ms <= 1000) {
    deltaTimeString = "now";
  } else {
    var unit;
    if (ms > 31557600000) {
      ms = Math.floor(ms / 31557600000);
      unit = "y";
    } else if (ms > 2592000000) {
      ms = Math.floor(ms / 2592000000);
      unit = "mo";
    } else if (ms > 604800000) {
      ms = Math.floor(ms / 604800000);
      unit = "w";
    } else if (ms > 86400000) {
      ms = Math.floor(ms / 86400000);
      unit = "d";
    } else if (ms > 3600000) {
      ms = Math.floor(ms / 3600000);
      unit = "h";
    } else if (ms > 60000) {
      ms = Math.floor(ms / 60000);
      unit = "m";
    } else if (ms > 1000) {
      ms = Math.floor(ms / 1000);
      unit = "s";
    }
    deltaTimeString = ms.toString() + unit;
  }
  return deltaTimeString;
}
function generateDateString() {
  const dateObject = new Date();
  const dateString =
    dateObject.getDate() + " " +
    months[dateObject.getMonth()] + " " +
    dateObject.getFullYear();
  return dateString;
}



////////////////
// GET ROUTES //
////////////////

app.get("/", function(req, res) {
  var ms = Infinity;
  switch (req.query.time) {
    case "today":
      ms = 86400000;
      break;
    case "week":
      ms = 604800000;
      break;
    case "month":
      ms = 2592000000;
      break;
    case "year":
      ms = 31557600000;
      break;
  }
  Question.find(function(err, questions) {
    if (err) {
      console.log(err);
    } else {
      questions = questions.filter(question => Date.now() - question.milliseconds < ms);
      questions.forEach(question => {
        const deltaTime = Date.now() - question.milliseconds;
        question.deltaTimeString = generateDeltaTimeString(deltaTime);
      });
      questions = questions.reverse();
      res.render("explore", {questions: questions});
    }
  });
});
app.get("/about", function(req, res) {
  res.render("about");
});
app.get("/questions/:questionId", function(req, res) {
  Question.findOne({_id: req.params.questionId}, function(err, question) {
    if (err) {
      console.log(err);
    } else {
      if (question) {
        question.answers.sort(function(a, b) {
          if (a.rating < b.rating) { return 1; }
          if (a.rating > b.rating) { return -1; }
          return 0;
        });
        const user = req.isAuthenticated() ? req.user : null;
        res.render("question", {question: question, user: user});
      } else {
        const error = {
          message: "Question not found",
          returnLink: "/",
          returnName: "home"
        };
        res.render("error", {error: error});
      }
    }
  });
});
app.get("/users/:userId", function(req, res) {
  User.findOne({_id: req.params.userId}, function(err, user) {
    if (err) {
      console.log(err);
    } else {
      if (user) {
        var questions = [];
        var answers = [];
        Question.find({_id: {$in: user.questions}}, function(err, founds) {
          if (err) {
            console.log(err);
          } else {
            if (founds) {
              founds.forEach(found => {
                const deltaTime = Date.now() - found.milliseconds;
                found.deltaTimeString = generateDeltaTimeString(deltaTime);
              });
              questions = founds;
            }
            Question.find({_id: {$in: user.answers}}, function(err, aFounds) {
              if (err) {
                console.log(err);
              } else {
                if (aFounds) {
                  aFounds.forEach(aFound => {
                    const deltaTime = Date.now() - aFound.milliseconds;
                    aFound.deltaTimeString = generateDeltaTimeString(deltaTime);
                    aFound.answers.forEach(answer => {
                      if (answer.authorId == user._id) {
                        answers.push({
                          question: aFound,
                          answer: answer
                        });
                      }
                    });
                  });
                }
                const isProfile = req.isAuthenticated() && req.user._id == req.params.userId;
                res.render("user", {user: user, questions: questions, answers: answers, isProfile: isProfile});
              }
            });
          }
        });
      } else {
        const error = {
          message: "User not found",
          returnLink: "/",
          returnName: "home"
        };
        res.render("error", {error: error});
      }
    }
  });
});
app.get("/profile", function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/users/" + req.user._id);
  } else {
    res.redirect("/login");
  }
});
app.get("/compose", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("compose");
  } else {
    res.redirect("/login");
  }
});
app.get("/login", function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/");
  } else {
    res.render("login");
  }
});
app.get("/signup", function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/");
  } else {
    res.render("signup");
  }
});
app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});
app.get("/dashboard", function(req, res) {
  if (req.isAuthenticated()) {
    if (req.user.status === 1 || req.user.status === 2) {
      Question.find(function(err, questions) {
        if (questions) {
          questions = questions.filter(q => q.reportCount > 0);
          questions.sort(function(a, b) {
            if (a.reportCount < b.reportCount) {
              return -1;
            }
            if (a.reportCount > b.reportCount) {
              return 1;
            }
            return 0;
          });
          questions = questions.slice(0, 5);
          questions.forEach(question => {
            const deltaTime = Date.now() - question.milliseconds;
            question.deltaTimeString = generateDeltaTimeString(deltaTime);
          });
        }
        res.render("dashboard", {questions: questions});
      });
    } else {
      res.redirect("/");
    }
  } else {
    res.redirect("/login");
  }
});



/////////////////
// POST ROUTES //
/////////////////

app.post("/about/feedback", function(req, res) {
  res.redirect("/");
});
app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/");
      });
    }
  });
});
app.post("/signup", function(req, res) {
  User.register(
    {
      username: req.body.username,
      dateString: generateDateString(),
      anonymousCount: 0,
      status: 0
    },
    req.body.password,
    function(err, user) {
      if (err) {
        console.log(err);
        res.redirect("/signup");
      } else {
        passport.authenticate("local")(req, res, function() {
          res.redirect("/");
        });
      }
    }
  );
});
app.post("/compose", function(req, res) {
  var isAnonymous = false;
  if (req.body.isAnonymous == "on") {
    isAnonymous = true;
    req.user.anonymousCount++;
  }
  if (req.isAuthenticated()) {
    const newQuestion = new Question({
      title: req.body.title,
      body: req.body.body,
      authorId: req.user._id,
      authorName: req.user.username,
      dateString: generateDateString(),
      deltaTimeString: "now",
      milliseconds: Date.now(),
      reportCount: 0,
      answerCount: 0,
      edited: false,
      isAnonymous: isAnonymous,
      tags: req.body.tags.split(","),
      usersReported: [],
      answers: []
    });
    req.user.questions.push(newQuestion._id);
    req.user.save(function(err) {
      if (err) {
        console.log(err);
      } else {
        newQuestion.save(function(err) {
          if (err) {
            console.log(err);
          } else {
            res.redirect("/");
          }
        });
      }
    });
  } else {
    res.redirect("/login");
  }
});
app.post("/questions/:questionId/update", function(req, res) {
  if (req.isAuthenticated()) {
    Question.findOne({_id: req.params.questionId}, function(err, question) {
      if (err) {
        console.log(err);
      } else {
        if (question) {
          if (question.authorId == req.user._id) {
            question.edited = true;
            question.body = req.body.newBody;
            question.save(function(err) {
              if (err) {
                console.log(err);
              } else {
                res.redirect("/questions/" + req.params.questionId);
              }
            });
          }
        } else {
          res.redirect("/questions/" + req.params.questionId);
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});
app.post("/questions/:questionId/delete", function(req, res) {
  if (req.isAuthenticated()) {
    Question.findOne({_id: req.params.questionId}, function(err, question) {
      if (err) {
        console.log(err);
      } else {
        if (question &&
          (question.authorId == req.user._id ||
            (req.user.status === 1 || req.user.status === 2)
          )
        ) {
          Question.deleteOne({_id: req.params.questionId}, function(err) {
            if (err) {
              console.log(err);
            } else {
              res.redirect("/");
            }
          });
        } else {
          res.redirect("/");
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});
app.post("/questions/:questionId/report", function(req, res) {
  if (req.isAuthenticated()) {
    Question.findOne({_id: req.params.questionId}, function(err, question) {
      if (err) {
        console.log(err);
      } else {
        if (question) {
          const i = question.usersReported.indexOf(req.user.username);
          if (i != -1) {
            question.usersReported.splice(i, 1);
            question.reportCount--;
          } else {
            question.usersReported.push(req.user.username);
            question.reportCount++;
          }
          question.save(function(err) {
            if (err) {
              console.log(err);
            } else {
              res.redirect("/questions/" + req.params.questionId);
            }
          });
        } else {
          res.redirect("/questions/" + req.params.questionId);
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});
app.post("/questions/:questionId/answer", function(req, res) {
  if (req.isAuthenticated()) {
    Question.findOne({_id: req.params.questionId}, function(err, question) {
      if (err) {
        console.log(err);
      } else {
        if (question) {
          const answer = new Answer({
            body: req.body.body,
            authorId: req.user._id,
            authorName: req.user.username,
            dateString: generateDateString(),
            rating: 0,
            usersUpvoted: [],
            usersDownvoted: []
          });
          question.answers.push(answer);
          question.answerCount++;
          req.user.answers.push(question._id);
          req.user.save(function(err) {
            if (err) {
              console.log(err);
            } else {
              question.save(function(err) {
                if (err) {
                  console.log(err);
                } else {
                  res.redirect("/questions/" + req.params.questionId);
                }
              });
            }
          });
        } else {
          res.redirect("/questions/" + req.params.questionId);
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});
app.post("/questions/:questionId/answers/:answerId/upvote", function(req, res) {
  if (req.isAuthenticated()) {
    Question.findOne({_id: req.params.questionId}, function(err, question) {
      if (err) {
        console.log(err);
      } else {
        if (question) {
          question.answers.forEach(answer => {
            if (answer._id == req.params.answerId) {
              const u = answer.usersUpvoted.indexOf(req.user.username);
              const d = answer.usersDownvoted.indexOf(req.user.username);
              if (u == -1) {
                answer.rating++;
                answer.usersUpvoted.push(req.user.username);
              } else {
                answer.rating--;
                answer.usersUpvoted.splice(u, 1);
              }
              if (d != -1) {
                answer.rating++;
                answer.usersDownvoted.splice(d, 1);
              }
            }
          });
          question.save(function(err) {
            if (err) {
              console.log(err);
            } else {
              res.redirect("/questions/" + req.params.questionId);
            }
          });
        } else {
          res.redirect("/questions/" + req.params.questionId);
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});
app.post("/questions/:questionId/answers/:answerId/downvote", function(req, res) {
  if (req.isAuthenticated()) {
    Question.findOne({_id: req.params.questionId}, function(err, question) {
      if (err) {
        console.log(err);
      } else {
        if (question) {
          question.answers.forEach(answer => {
            if (answer._id == req.params.answerId) {
              const u = answer.usersUpvoted.indexOf(req.user.username);
              const d = answer.usersDownvoted.indexOf(req.user.username);
              if (d == -1) {
                answer.rating--;
                answer.usersDownvoted.push(req.user.username);
              } else {
                answer.rating++;
                answer.usersDownvoted.splice(d, 1);
              }
              if (u != -1) {
                answer.rating--;
                answer.usersUpvoted.splice(u, 1);
              }
            }
          });
          question.save(function(err) {
            if (err) {
              console.log(err);
            } else {
              res.redirect("/questions/" + req.params.questionId);
            }
          });
        } else {
          res.redirect("/questions/" + req.params.questionId);
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});
app.post("/users/:userId/bio/update", function(req, res) {
  if (req.isAuthenticated()) {
    User.findOne({_id: req.params.userId}, function(err, user) {
      if (err) {
        console.log(err);
      } else {
        if (user) {
          if (req.user._id == req.params.userId) {
            user.bio = req.body.bio;
            user.save(function(err) {
              if (err) {
                console.log(err);
              } else {
                res.redirect("/users/" + req.params.userId);
              }
            });
          }
        } else {
          res.redirect("/users/" + req.params.userId);
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});



//////////////////////
// ABANDONED ROUTES //
//////////////////////

// app.post("/questions/:questionId/answers/:answerId/update", function(req, res) {
//   if (req.isAuthenticated()) {
//     Question.findOne({_id: req.params.questionId}, function(err, question) {
//       if (err) {
//         console.log(err);
//       } else {
//         if (question) {
//           question.answers.forEach(answer => {
//             if (answer._id == req.params.answerId) {
//               answer.edited = true;
//               answer.body = req.body.newBody;
//             }
//           });
//           question.save(function(err) {
//             if (err) {
//               console.log(err);
//             } else {
//               res.redirect("/questions/" + req.params.questionId);
//             }
//           });
//         } else {
//           res.redirect("/questions/" + req.params.questionId);
//         }
//       }
//     });
//   } else {
//     res.redirect("/login");
//   }
// });
// app.post("/questions/:questionId/answers/:answerId/delete", function(req, res) {
//   if (req.isAuthenticated()) {
//     Question.findOne({_id: req.params.questionId}, function(err, question) {
//       if (err) {
//         console.log(err);
//       } else {
//         if (question) {
//           question.answers.forEach(answer => {
//             if (answer._id == req.params.answerId) {
//               const i = answer.usersReported.indexOf(req.user.username);
//               question.answers.splice(i, 1);
//             }
//           });
//           question.save(function(err) {
//             if (err) {
//               console.log(err);
//             } else {
//               res.redirect("/questions/" + req.params.questionId);
//             }
//           });
//         } else {
//           res.redirect("/questions/" + req.params.questionId);
//         }
//       }
//     });
//   } else {
//     res.redirect("/login");
//   }
// });
// app.post("/questions/:questionId/answers/:answerId/report", function(req, res) {
//   if (req.isAuthenticated()) {
//     Question.findOne({_id: req.params.questionId}, function(err, question) {
//       if (err) {
//         console.log(err);
//       } else {
//         if (question) {
//           question.answers.forEach(answer => {
//             if (answer._id == req.params.answerId) {
//               const i = answer.usersReported.indexOf(req.user.username);
//               if (i != -1) {
//                 answer.usersReported.splice(i, 1);
//                 answer.reportCount--;
//               } else {
//                 answer.usersReported.push(req.user.username);
//                 answer.reportCount++;
//               }
//             }
//           });
//           question.save(function(err) {
//             if (err) {
//               console.log(err);
//             } else {
//               res.redirect("/questions/" + req.params.questionId);
//             }
//           });
//         } else {
//           res.redirect("/questions/" + req.params.questionId);
//         }
//       }
//     });
//   } else {
//     res.redirect("/login");
//   }
// });



//////////////////
// START SERVER //
//////////////////

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.listen(port, function() {
  console.log("Server has started successfully");
});
