import React from "react";
import { Formik, Form } from "formik";
import {
  TextField,
  Button,
  Divider,
  Typography,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Checkbox,
  LinearProgress,
} from "@material-ui/core";
import PropTypes from "prop-types";
import styles from "./index.module.scss";
import getLeads from "../../../scripts/getLeads";
import formatEmailVars from "../../../scripts/formatEmailVars";
import UserDataContext from "../../../context/userData";
import SectionContainer from "../../SectionContainer";

class GetGoogleLeads extends React.Component {
  static initialEmailVars = [
    "to",
    "from",
    "contactNumber",
    "contactPage",
    "website",
    "facebookPageName",
    "facebookPageLink",
    "instagramPageLink",
    "domain",
  ];

  static contextType = UserDataContext;

  constructor(props) {
    super(props);

    this.state = {
      form: props.initialValues
        ? Object.assign(props.initialValues, {})
        : {
            searches: "",
            num: 10,
            createDrafts: true,
            getSemRushInfo: false,
            email: "",
            timeframe: "anytime",
            sender: "@webspred.com",
            subject: "",
            saveToGoogle: true,
          },
      processes: [],
      emailVars: GetGoogleLeads.initialEmailVars,
      focusContainer: 0,
    };

    this.submitForm = this.submitForm.bind(this);
    this.saveToGoogle = this.saveToGoogle.bind(this);
    this.changeFocusContainer = this.changeFocusContainer.bind(this);
    this.checkToken = this.checkToken.bind(this);
  }

  componentDidMount() {
    this.tokenCheck = setInterval(this.checkToken, 5000); // Set the timeout
  }

  componentWillUnmount() {
    clearInterval(this.tokenCheck); // Clear the interval
  }

  checkToken() {
    const { notificationDispatcher } = this.props;
    const token = this.context.token;

    // If it didn't return an object or a token
    if (!token || !token.token) {
      notificationDispatcher({
        type: "add",
        item: {
          type: "info",
          message:
            "Creating drafts won't work until you authorize with Google.",
        },
      });
    } else if (token && token.hasOwnProperty("createdAt")) {
      // Add 3/4 of an hour so we have 15 minutes left of how long the token is valid for
      const tokenDate = new Date(
        new Date(token.createdAt).getTime() + 45 * 60000
      );

      // If the current date and time is still larger than the valid timeframe of the token, then alert the user.
      if (new Date().getTime() > tokenDate.getTime()) {
        notificationDispatcher({
          type: "add",
          item: {
            type: "info",
            message:
              "Your token is no longer valid. Please re-authenticate with Google to be able to create drafts.",
          },
        });
      }
    }
  }

  async saveToGoogle(leads, draftsCreated = false) {
    const val = (val) => val || "N/A";

    const data = [];

    for (const {
      domainName,
      website,
      contactPage,
      facebookPage,
      instagramPage,
    } of Object.values(leads)) {
      // Format the data in an array, each elem is a column
      data.push([
        val(domainName.replace(/\..*$/, "")),
        val(website),
        val(contactPage.link),
        val(contactPage.email),
        val(contactPage.number),
        "N/A", // Don't fill in the contact name as we can't get it
        val(facebookPage.link),
        val(facebookPage.pageTitle),
        val(facebookPage.likes),
        val(facebookPage.followers),
        val(instagramPage.link),
        val(instagramPage.username), // TODO: Not yet configured
        val(instagramPage.followers),
        val(instagramPage.following),
        contactPage.email && draftsCreated ? "TRUE" : "FALSE",
      ]);
    }

    try {
      return await window.ipcRenderer.invoke("saveToGoogleSheets", {
        spreadsheetId: "1_0XlG1KEYESxm9sWMhwJ4kbWKRCAlSAS2qT1K3YS8ZE",
        token: this.context.token.token,
        data,
      });
    } catch (e) {
      console.log(e);
      console.log("Failed to save data to Google.");
      throw e;
    }
  }

  /**
   * Gathers the leads based on the values from the form.
   * @param {object} values - Form values
   * @param {object} props - Form props
   */
  submitForm(values, props) {
    const { notificationDispatcher } = this.props;
    const { token } = this.context.token; // Get the actual token from the context
    const { setSubmitting } = props;
    const searches = values.searches
      .split("\n")
      .map((search) => search.trim())
      .filter(Boolean); // Each line is a new search and trim the values and only get non-falsey values

    return new Promise(async (resolve, reject) => {
      // Add the search strings to the processes list
      this.setState(({ processes }) => ({
        processes: [...processes, ...searches],
      }));

      let timeframe = values.timeframe.charAt(0); // Get the first letter

      if (timeframe === "anytime") {
        // The "anytime" identifier should be empty
        timeframe = "";
      }

      // Token check if we are creating drafts or saving information to Google Sheets
      if ((values.createDrafts || values.saveToGoogle) && !token) {
        // No google token provided
        setSubmitting(false);

        // Alert the user that they need to authenticate
        notificationDispatcher({
          type: "add",
          item: {
            type: "error",
            message: "Authorize Google first.",
          },
        });
        setSubmitting(false);
        return reject(new Error("Authentice Google first."));
      }

      // Get the leads from the search
      let leads = {};

      for (let search of searches) {
        try {
          const leadResults = await getLeads({
            search: search,
            count: values.num,
            timeframe,
          });

          if (!leadResults.status) {
            throw new Error(leadResults.body.msg);
          }

          leads = { ...leads, ...leadResults.body.results };
        } catch (e) {
          console.log(e);
          notificationDispatcher({
            type: "add",
            item: {
              type: "error",
              message: `Failed to get data for "${search}".`,
            },
          });
          setSubmitting(false);
          return reject(e);
        }

        // Once this search has finished, we can remove the process from the list
        this.setState(({ processes }) => ({
          processes: processes.filter((keyword) => keyword !== search),
        }));
      }

      console.log(leads);

      // Get unique leads compare if we are saving to Google.
      if (values.saveToGoogle) {
        try {
          leads = await window.ipcRenderer.invoke("getUniqueLeads", {
            leads: leads,
            token: this.context.token.token,
          });

          if (Object.keys(leads).length === 0) {
            notificationDispatcher({
              type: "add",
              item: {
                type: "info",
                message: "No new leads found.",
              },
            });
            setSubmitting(false);
            return resolve();
          }
        } catch (e) {
          console.log(e);
          console.log("Failed to get unique leads");
          notificationDispatcher({
            type: "add",
            item: {
              type: "error",
              message:
                "Failed to get compare leads against those saved in Google.",
            },
          });
          setSubmitting(false);
          return reject(e);
        }
      }

      if (!values.createDrafts) {
        if (values.saveToGoogle) {
          try {
            await this.saveToGoogle(leads);

            notificationDispatcher({
              type: "add",
              item: {
                type: "success",
                message: "Successfully saved leads to Google.",
              },
            });
          } catch (e) {
            console.log(e);
            console.log("Failed to save data to Google.");
            notificationDispatcher({
              type: "add",
              item: {
                type: "error",
                message: "Failed to save data to Google.",
              },
            });
            setSubmitting(false);
            reject(e);
          }
        }

        // If we are not creating drafts then we can finish here
        setSubmitting(false);
        return resolve();
      }

      // Only get the email addresses
      const emailAddressLeads = Object.keys(leads).reduce((r, key) => {
        if (leads[key].contactPage.email) {
          r = { ...r, [key]: leads[key] }; // Add the element to the object
        }

        return r;
      }, {});

      // If we are creating drafts but there are no emails to be sent
      if (values.createDrafts) {
        // If there are no emails that could be sent
        if (Object.keys(emailAddressLeads).length === 0) {
          notificationDispatcher({
            type: "add",
            item: {
              type: "info",
              message: "No emails found from search results.",
            },
          });
          setSubmitting(false);
          return resolve();
        }
      }

      // If we are getting semrush info
      let semrushData;
      if (values.getSemRushInfo) {
        try {
          semrushData = await window.ipcRenderer.invoke("getSemrushData", {
            domains: Object.values(emailAddressLeads).map(
              (info) => info.domainName
            ), // All the leads that have gone through the filter
            returnData: [
              // The data we want to get on the domain
              "screenshot",
              "organic_search_traffic",
              "authority_score",
            ],
          });
        } catch (e) {
          console.log(e);
          notificationDispatcher({
            type: "add",
            item: {
              type: "error",
              message: "Failed to get Semrush data.",
            },
          });
          setSubmitting(false);
          return reject(e);
        }
      }

      // Create the email drafts
      const emailDrafts = Object.entries(emailAddressLeads).map(
        ([domain, info]) => {
          const semrushDomainData = semrushData // Get the semrush data if it is defined
            ? semrushData.data[
                Object.keys(semrushData.data).find(
                  (semrushDomain) => semrushDomain === info.domainName
                )
              ]
            : null;

          // Create the email vars that will be available
          const emailVars = {
            to: info.contactPage.email,
            from: values.sender,
            contactNumber: info.contactPage.number,
            contactPage: info.contactPage.link,
            website: info.website,
            facebookPageLink: info.facebookPage.link,
            instagramPageLink: info.instagramPage.link,
            domain,
            // Now add the semrush info
            ...(values.getSemRushInfo && // If we have gotten the semrush data
              semrushDomainData && {
                authorityScore: semrushDomainData.authority_score,
                organicSearchTraffic: semrushDomainData.organic_search_traffic,
                semrushScreenshot: semrushDomainData.screenshot
                  ? `<img src="cid:${
                      semrushDomainData.screenshot.match(/\w+\.png/)[0]
                    }" style="width: 500px; height: auto;"/>`
                  : null, // HTML image embedding
              }),
          };

          return {
            to: info.contactPage.email,
            sender: values.sender,
            subject: formatEmailVars({
              // Format the subject
              email: values.subject,
              variables: emailVars,
            }),
            html: formatEmailVars({
              // Format the email
              email: values.email,
              variables: emailVars,
            }),
            ...(values.getSemRushInfo && // If we have gotten the semrush data
              semrushDomainData &&
              semrushDomainData.screenshot && {
                attachments: [
                  {
                    filename: semrushDomainData.screenshot.match(/\w+\.png/)[0], // Domain png
                    path: semrushDomainData.screenshot,
                    cid: semrushDomainData.screenshot.match(/\w+\.png/)[0],
                  },
                ],
              }),
          };
        }
      );

      // Emails have been defined. Now we create them

      let draftResult;

      try {
        draftResult = await window.ipcRenderer.invoke("createDrafts", {
          token,
          emails: emailDrafts,
        });
      } catch (e) {
        console.log(e);
        notificationDispatcher({
          type: "add",
          item: {
            type: "error",
            message: "Unnexpected error in gathering Semrush data.",
          },
        });
        setSubmitting(false);
        return reject(e);
      }

      // Notify the user of the result
      notificationDispatcher({
        type: "add",
        item: {
          type: draftResult.status ? "success" : "error",
          message: draftResult.status
            ? draftResult.message
            : draftResult.message + " Try authenticating again.",
        },
      });

      // We have finished
      setSubmitting(false);

      if (this.saveToGoogle) {
        try {
          await this.saveToGoogle(leads, true);

          notificationDispatcher({
            type: "add",
            item: {
              type: "success",
              message: "Successfully saved leads to Google.",
            },
          });
        } catch (e) {
          console.log(e);
          console.log("Failed to save data to Google.");
          notificationDispatcher({
            type: "add",
            item: {
              type: "error",
              message: "Failed to save data to Google.",
            },
          });
          setSubmitting(false);
          reject(e);
        }
      }

      setSubmitting(false);
      return resolve();
    });
  }

  changeFocusContainer(i) {
    if (this.state.focusContainer !== i) {
      this.setState({ focusContainer: i });
    }
  }

  render() {
    return (
      <>
        <Formik
          initialValues={Object.freeze(this.state.form)}
          validate={(values) => {
            const errors = {};

            if (!values.searches)
              errors.searches = "Please enter your Google searches.";
            if (values.num <= 0)
              errors.num = "Please enter a number larger than 0.";
            if (values.num > 100)
              errors.num = "Please enter a number smaller than 100.";

            if (values.createDrafts) {
              if (!values.sender || !values.sender.match(/^.+?@.+?\..+$/g))
                errors.sender = "Please enter your email address.";
              if (!values.subject) errors.subject = "Please enter a subject.";
              if (!values.email) errors.email = "Please enter an email";
            }

            return errors;
          }}
          onSubmit={(values, props) => {
            this.submitForm(values, props).catch((err) => {}); // Do nothing on err
          }}
          validateOnChange={false}
          validateOnBlur={false}
        >
          {(props) => {
            const {
              values,
              errors,
              handleChange,
              handleBlur,
              handleSubmit,
              isSubmitting,
              setValues,
            } = props;

            return (
              <Form>
                <SectionContainer
                  focussed={this.state.focusContainer === 0}
                  onClick={() => this.changeFocusContainer(0)}
                >
                  <TextField
                    label="Searches"
                    name="searches"
                    onChange={handleChange}
                    onBlur={handleBlur}
                    value={values.searches}
                    error={Boolean(errors.searches)}
                    helperText={
                      errors.searches || "Enter your Google searches."
                    }
                    fullWidth
                    multiline
                    rows={4}
                  />
                  <div className={styles.FormContainer}>
                    <TextField
                      label="Count"
                      name="num"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.num}
                      error={Boolean(errors.num)}
                      type="number"
                      helperText={errors.num || "Number of results to get."}
                    />
                    <TextField
                      label="Timeframe"
                      name="timeframe"
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.timeframe}
                      error={Boolean(errors.timeframe)}
                      helperText={
                        errors.timeframe || "Timeframe of the results."
                      }
                      select
                    >
                      {["day", "week", "month", "anytime"].map((timeframe) => (
                        <MenuItem key={timeframe} value={timeframe}>
                          {timeframe.charAt(0).toUpperCase() +
                            timeframe.slice(1)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </div>
                </SectionContainer>
                <SectionContainer
                  focussed={this.state.focusContainer === 1}
                  onClick={() => this.changeFocusContainer(1)}
                >
                  <div className={styles.CheckboxContainer}>
                    <FormLabel>Save To Google?</FormLabel>
                    <FormControlLabel
                      control={
                        <Checkbox
                          name="saveToGoogle"
                          checked={values.saveToGoogle}
                          onChange={handleChange}
                          onBlur={handleBlur}
                        />
                      }
                      label="Yes"
                    />
                  </div>
                </SectionContainer>
                <SectionContainer
                  focussed={this.state.focusContainer === 2}
                  onClick={() => this.changeFocusContainer(2)}
                >
                  <div className={styles.CheckboxContainer}>
                    <FormLabel>Create Email Drafts?</FormLabel>
                    <FormControlLabel
                      control={
                        <Checkbox
                          name="createDrafts"
                          checked={values.createDrafts}
                          onChange={handleChange}
                          onBlur={handleBlur}
                        />
                      }
                      label="Yes"
                    />
                  </div>
                </SectionContainer>
                {values.createDrafts && (
                  // Only show if we are creating email drafts
                  <>
                    {
                      // Disabled for now since we no longer have SemRush
                    }
                    {/* <SectionContainer
                      focussed={this.state.focusContainer === 3}
                      onClick={() => this.changeFocusContainer(3)}
                    >
                      <div className={styles.CheckboxContainer}>
                        <FormLabel>Get SemRush info?</FormLabel>
                        <FormControlLabel
                          control={
                            <Checkbox
                              name="getSemRushInfo"
                              checked={values.getSemRushInfo}
                              onChange={(e) => {
                                // Set the extra available variables
                                this.setState(({ emailVars }) => ({
                                  emailVars: e.target.checked
                                    ? [
                                        ...emailVars,
                                        "authorityScore",
                                        "organicSearchTraffic",
                                        "semrushScreenshot",
                                      ]
                                    : GetGoogleLeads.initialEmailVars,
                                }));
                                handleChange(e);
                              }}
                              onBlur={handleBlur}
                            />
                          }
                          label="Yes"
                        />
                      </div>
                    </SectionContainer> */}
                    <SectionContainer
                      focussed={this.state.focusContainer === 4}
                      onClick={() => this.changeFocusContainer(4)}
                    >
                      <div className={styles.EmailContainer}>
                        <div className={styles.OutlinedBtnContainer}>
                          {["ben", "andrew"].map((name) => (
                            <Button
                              key={name}
                              onClick={() =>
                                setValues({
                                  ...values,
                                  sender: name + "@webspred.com",
                                })
                              }
                              size="small"
                              variant="outlined"
                            >
                              {name}
                            </Button>
                          ))}
                        </div>
                        <TextField
                          name="sender"
                          placeholder="From"
                          onChange={handleChange}
                          onBlur={handleBlur}
                          value={values.sender}
                          error={Boolean(errors.sender)}
                          fullWidth
                          helperText={errors.sender || ""}
                        />
                        <div className={styles.OutlinedBtnContainer}>
                          {this.state.emailVars.map((emailVar) => (
                            <Button
                              key={emailVar}
                              onClick={() =>
                                setValues({
                                  ...values,
                                  subject: values.subject + `{{${emailVar}}}`,
                                })
                              }
                              variant="outlined"
                              size="small"
                            >
                              {emailVar}
                            </Button>
                          ))}
                        </div>
                        <TextField
                          name="subject"
                          placeholder="Subject"
                          onChange={handleChange}
                          onBlur={handleBlur}
                          value={values.subject}
                          error={Boolean(errors.subject)}
                          fullWidth
                          helperText={errors.subject || ""}
                        />
                        <div className={styles.OutlinedBtnContainer}>
                          {this.state.emailVars.map((emailVar) => (
                            <Button
                              key={emailVar}
                              onClick={() =>
                                setValues({
                                  ...values,
                                  email: values.email + `{{${emailVar}}}`,
                                })
                              }
                              variant="outlined"
                              size="small"
                            >
                              {emailVar}
                            </Button>
                          ))}
                        </div>
                        <TextField
                          name="email"
                          multiline
                          onChange={handleChange}
                          onBlur={handleBlur}
                          value={values.email}
                          error={Boolean(errors.email)}
                          fullWidth
                          rows={12}
                          helperText={
                            errors.email ||
                            "Available vars: " +
                              this.state.emailVars.join(" | ")
                          }
                        />
                      </div>
                    </SectionContainer>
                  </>
                )}
                <Divider className={styles.Divider} />
                <div className={styles.BtnContainer}>
                  <Button onClick={handleSubmit} disabled={isSubmitting}>
                    Submit
                  </Button>
                </div>
              </Form>
            );
          }}
        </Formik>
        {this.state.processes.length > 0 && (
          <div className={styles.ProcessesDiv}>
            <Typography>Current Active Processes</Typography>
            <div className={styles.ProcessesContainer}>
              {this.state.processes.map((keyword) => (
                <div key={keyword} className={styles.Process}>
                  <span>{keyword}</span>
                  <LinearProgress
                    variant="indeterminate"
                    className={styles.Progress}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }
}

GetGoogleLeads.propTypes = {
  initialValues: PropTypes.object,
  notificationDispatcher: PropTypes.func,
};

export default GetGoogleLeads;
