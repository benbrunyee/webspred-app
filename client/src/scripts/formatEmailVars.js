/**
 * Formats en email containing variable placeholders with the actual values or backup values.
 * @param {string} email - The email containing the variable placeholders. Placeholders = {{}}
 * @param {object} variables - The variables which will be substituted.
 */
const formatEmailVars = ({ email, variables }) => {
  let matches = email.match(/\{\{.*?\}\}/g); // First we obtain the groups of variable matches

  // If there were no matches then return the email
  if (!matches) {
    return email;
  }

  // Turn the matches array into an array of objects containing more required information on the identifier e.g. backup etc...
  matches = matches.map((match) => {
    const backup = (match.match(/\|(.*?)\}\}/) || [])[1]; // Try match for the backup string

    if (backup) {
      const key = match.match(/\{\{(.*?)\|/)[1]; // Match everything between identifier and backup operator
      return {
        key: key.replace(/\s/g, ""), // Replace all spaces
        backup: backup.replace(/\s/g, ""), // There is backup and replace all spaces
        regex: new RegExp(`\\{\\{(\\s+?)?${key}(\\s+?)?\\|(\\s+?)?\\w+(\\s+?)?\\}\\}`, "g"), // Creating regex using the key variable
      };
    } else {
      const key = match.match(/\{\{(.*?)\}\}/)[1];
      return {
        key: key.replace(/\s/g, ""), // Replace all spaces
        backup: false, // There is no backup
        regex: new RegExp(`\\{\\{(\\s+?)?${key}(\\s+?)?\\}\\}`, "g"), // Creating regex using the key variable
      };
    }
  });

  let resultEmail = email;

  for (let match of matches) {
    if (variables[match.key]) {
      resultEmail = resultEmail.replace(match.regex, variables[match.key]);
    } else {
      if (match.backup) {
        resultEmail = resultEmail.replace(match.regex, match.backup); // Replace with the backup value
      } else {
        resultEmail = resultEmail.replace(match.regex, ""); // There is no value and there is no backup so replace with nothing
      }
    }
  }

  // Replace all new lines with a breakpoint (formatting for html)
  resultEmail = resultEmail.replace(/\n/g, "<br/>");

  return resultEmail;
};

export default formatEmailVars;

/*
  Example email:
  Hi {{ Person | There }},
  As {{ Job_Title }} of {{ Workplace }} i am sure...
*/

/*
 Grab all the possible vars used in email.
 For every var used in email - we want to check if there is a backup string
 If there isn't a backup string then do a simple replace.
 If there is a backup string then check if the data exists and if it doesn't then replace with the backup string.
*/
