App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,
  isAdminPage: false,
  currentSession: 0,

  init: async function() {
    // Check if we're on the admin page
    App.isAdminPage = window.location.pathname.includes('admin.html');
    return await App.initWeb3();
  },

  initWeb3: async function() {
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      window.web3 = new Web3(window.ethereum);
    } else if (typeof web3 !== 'undefined') {
      App.web3Provider = web3.currentProvider;
      window.web3 = new Web3(web3.currentProvider);
    } else {
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
      window.web3 = new Web3(App.web3Provider);
      console.log('No MetaMask detected, using fallback');
    }

    return App.initContract();
  },

  initContract: function() {
    $.getJSON("Election.json", function(election) {
      App.contracts.Election = TruffleContract(election);
      App.contracts.Election.setProvider(App.web3Provider);

      App.listenForEvents();
      App.render();
    });
  },

  listenForEvents: function() {
    App.contracts.Election.deployed().then(function(instance) {
      // Listen for vote events
      instance.votedEvent({}, {
        fromBlock: 'latest'
      }).watch(function(error, event) {
        console.log("vote event triggered", event);
        App.render();
      });

      // Listen for session change events
      instance.sessionChanged({}, {
        fromBlock: 'latest'
      }).watch(function(error, event) {
        console.log("session changed event triggered", event);
        App.currentSession = event.args._newSessionId.toNumber();
        App.render();
      });

      // Listen for candidate events
      instance.candidateAdded({}, {
        fromBlock: 'latest'
      }).watch(function(error, event) {
        console.log("candidate added event triggered", event);
        App.render();
      });

      instance.candidateUpdated({}, {
        fromBlock: 'latest'
      }).watch(function(error, event) {
        console.log("candidate updated event triggered", event);
        App.render();
      });

      instance.candidateRemoved({}, {
        fromBlock: 'latest'
      }).watch(function(error, event) {
        console.log("candidate removed event triggered", event);
        App.render();
      });
    });
  },

  render: async function() {
    var electionInstance;
    var loader = $("#loader");
    var content = $("#content");

    loader.show();
    content.hide();

    // Check for accounts
    let accounts = [];
    if (window.ethereum) {
      accounts = await window.ethereum.request({ method: 'eth_accounts' });
    } else if (window.web3) {
      accounts = await window.web3.eth.getAccounts();
    }

    if (accounts.length > 0) {
      App.account = accounts[0];
      $("#accountAddress").html("Your Account: " + App.account);
      $("#connectButton").html("Connected").addClass("btn-success").removeClass("btn-primary");
      $("#connectButton").prop("disabled", true);
    } else {
      $("#accountAddress").html("Your Account: Not connected");
      $("#connectButton").html("Connect Wallet").addClass("btn-primary").removeClass("btn-success");
      $("#connectButton").prop("disabled", false);
    }

    App.contracts.Election.deployed().then(function(instance) {
      electionInstance = instance;
      return electionInstance.getCurrentSession();
    }).then(function(sessionId) {
      App.currentSession = sessionId.toNumber();
      if (App.isAdminPage) {
        $("#currentSession").html("Current Session: " + App.currentSession);
      }
      return electionInstance.candidatesCount();
    }).then(function(candidatesCount) {
      // Only show results table on admin page
      if (App.isAdminPage) {
        var candidatesResults = $("#candidatesResults");
        candidatesResults.empty();

        for (var i = 1; i <= candidatesCount; i++) {
          (function(id) {
            electionInstance.candidates(id).then(function(candidate) {
              var id = candidate[0].toNumber();
              var name = candidate[1];
              var voteCount = candidate[2].toNumber();
              var exists = candidate[3];

              if (exists) {
                // Render candidate Result with action buttons
                var candidateTemplate = "<tr><th>" + id + "</th><td>" + name + "</td><td>" + voteCount + "</td>" +
                  "<td class='action-buttons'>" +
                  "<button onclick='App.editCandidate(" + id + ", \"" + name + "\")' class='btn btn-sm btn-info'>Edit</button> " +
                  "<button onclick='App.removeCandidate(" + id + ")' class='btn btn-sm btn-danger'>Remove</button>" +
                  "</td></tr>";
                candidatesResults.append(candidateTemplate);
              }
            });
          })(i);
        }
      }

      // Only show voting form on voter page
      if (!App.isAdminPage) {
        var candidatesSelect = $('#candidatesSelect');
        candidatesSelect.empty();

        for (var i = 1; i <= candidatesCount; i++) {
          (function(id) {
            electionInstance.candidates(id).then(function(candidate) {
              var id = candidate[0].toNumber();
              var name = candidate[1];
              var exists = candidate[3];
              
              if (exists) {
                // Render candidate ballot option
                var candidateOption = "<option value='" + id + "'>" + name + "</option>";
                candidatesSelect.append(candidateOption);
              }
            });
          })(i);
        }
      }
      
      return electionInstance.hasVoted(App.account);
    }).then(function(hasVoted) {
      // Only handle voting UI on voter page
      if (!App.isAdminPage) {
        if (hasVoted) {
          $('#votingForm').hide();
          $('#voteMessage').show();
        } else {
          $('#voteMessage').hide();
          $('#votingForm').show();
        }
      }

      loader.hide();
      content.show();
    }).catch(function(error) {
      console.warn(error);
    });
  },

  castVote: function() {
    var candidateId = $('#candidatesSelect').val();
    App.contracts.Election.deployed().then(function(instance) {
      return instance.vote(candidateId, { from: App.account });
    }).then(function(result) {
      // After voting, the events listener will trigger App.render()
      $("#content").hide();
      $("#loader").show();
    }).catch(function(err) {
      console.error(err);
    });
  },

  startNewSession: function() {
    App.contracts.Election.deployed().then(function(instance) {
      return instance.startNewSession({ from: App.account });
    }).then(function(result) {
      $("#content").hide();
      $("#loader").show();
    }).catch(function(error) {
      console.error(error);
    });
  },

  addCandidate: function() {
    var candidateName = $('#candidateName').val().trim();
    if (!candidateName) {
      alert("Please enter a candidate name");
      return;
    }

    $("#content").hide();
    $("#loader").show();

    App.contracts.Election.deployed().then(function(instance) {
      return instance.addCandidate(candidateName, { from: App.account });
    }).then(function(result) {
      // Clear the form
      $('#candidateName').val('');
      // The candidateAdded event will trigger a re-render
    }).catch(function(error) {
      console.error(error);
      $("#content").show();
      $("#loader").hide();
      alert("Error adding candidate. Please try again.");
    });
  },

  editCandidate: function(id, name) {
    $('#editCandidateId').val(id);
    $('#editCandidateName').val(name);
    $('#editCandidateModal').modal('show');
  },

  updateCandidate: function() {
    var id = $('#editCandidateId').val();
    var newName = $('#editCandidateName').val().trim();

    if (!newName) {
      alert("Please enter a candidate name");
      return;
    }

    $("#editCandidateModal").modal('hide');
    $("#content").hide();
    $("#loader").show();

    App.contracts.Election.deployed().then(function(instance) {
      return instance.updateCandidateName(id, newName, { from: App.account });
    }).then(function(result) {
      // The candidateUpdated event will trigger a re-render
    }).catch(function(error) {
      console.error(error);
      $("#content").show();
      $("#loader").hide();
      alert("Error updating candidate. Please try again.");
    });
  },

  removeCandidate: function(id) {
    if (!confirm("Are you sure you want to remove this candidate?")) {
      return;
    }

    $("#content").hide();
    $("#loader").show();

    App.contracts.Election.deployed().then(function(instance) {
      return instance.removeCandidate(id, { from: App.account });
    }).then(function(result) {
      // The candidateRemoved event will trigger a re-render
    }).catch(function(error) {
      console.error(error);
      $("#content").show();
      $("#loader").hide();
      alert("Error removing candidate. Please try again.");
    });
  },

  connectMetaMask: async function() {
    try {
      if (window.ethereum) {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        App.render();
      } else {
        alert("Please install MetaMask!");
      }
    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
    }
  }
};

$(function() {
  $(window).load(function() {
    App.init();
    if ($('#connectButton').length) {
      $('#connectButton').on('click', App.connectMetaMask);
    }
    if ($('#addCandidateButton').length) {
      $('#addCandidateButton').on('click', App.addCandidate);
    }
  });
});
