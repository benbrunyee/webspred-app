import {
  Button,
  MenuItem,
  TextField,
  Divider,
  FormControlLabel,
  FormLabel,
  Checkbox,
} from "@material-ui/core";
import { Formik, Form } from "formik";
import React, { useState, useContext } from "react";
import SectionContainer from "../../SectionContainer";
import styles from "./index.module.scss";
import UserDataContext from "../../../context/userData";

const GetLinkedInLeads = ({ notificationDispatcher }) => {
  const [form] = useState({
    email: "",
    password: "",
    search: {
      term: "",
      params: {
        industry: "",
        location: "",
        companySize: "",
      },
      type: "",
    },
    numOfResults: 10,
    researchWebsite: false,
    saveToGoogle: false,
  });

  const [selectedContainer, setSelectedContainer] = useState(0);

  const [result, setResult] = useState([]);

  const userData = useContext(UserDataContext);

  const copySearch = (arr) => {
    navigator.clipboard.writeText(arr.filter((elem) => elem).join(", "));

    notificationDispatcher({
      type: "add",
      item: {
        type: "success",
        message: "Copied search",
      },
    });
  };

  return (
    <Formik
      initialValues={Object.assign({}, form)}
      onSubmit={async (values) => {
        try {
          const result = await window.ipcRenderer.invoke("getLinkedInLeads", {
            ...values,
            token: userData.token.token,
          });

          if (!result.status) {
            console.warn(result);
            throw new Error("Leads gathering failed.");
          }

          setResult(result.data);
          console.log(result.data);
          notificationDispatcher({
            type: "add",
            item: {
              type: "success",
              message: `Successfully got ${result.data.length} leads.`,
            },
          });
        } catch (e) {
          console.warn(e);
          notificationDispatcher({
            type: "add",
            item: {
              type: "error",
              message: "Failed to get leads.",
            },
          });
        }
      }}
      validate={(values) => {
        const errors = {};

        if (!values.email) errors.email = "Please enter your LinkedIn email.";
        if (!values.password)
          errors.password = "Please enter your LinkedIn password,.";

        if (!values.search.term)
          errors.search = {
            ...(errors.search || {}),
            term: "Please enter a search term.",
          };

        if (!values.numOfResults)
          errors.numOfResults = "Please enter a value above 0.";

        return errors;
      }}
      validateOnChange={false}
      validateOnBlur={false}
    >
      {({ values, errors, handleChange, handleBlur, handleSubmit }) => (
        <Form>
          <SectionContainer
            focussed={selectedContainer === 0}
            onClick={() => setSelectedContainer(0)}
            className={styles.SpacedContainer}
          >
            <TextField
              name="email"
              label="Email"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.email}
              error={Boolean(errors.email)}
              helperText={errors.email}
              fullWidth
              required
              autoComplete="email"
            />
            <TextField
              name="password"
              label="Password"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.password}
              error={Boolean(errors.password)}
              helperText={errors.password}
              type="password"
              fullWidth
              required
              autoComplete="current-password"
            />
          </SectionContainer>
          <SectionContainer
            focussed={selectedContainer === 1}
            onClick={() => setSelectedContainer(1)}
          >
            <TextField
              name="search.term"
              label="Search Term"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.search.term}
              error={Boolean(errors.search?.term)}
              helperText={
                errors.search?.term || "Enter your LinkedIn search query."
              }
              fullWidth
              required
            />
          </SectionContainer>
          <SectionContainer
            focussed={selectedContainer === 2}
            onClick={() => setSelectedContainer(2)}
          >
            <TextField
              name="search.type"
              label="Type of search"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.search.type}
              error={Boolean(errors.search?.type)}
              helperText={errors.search?.type}
              fullWidth
              select
            >
              <MenuItem value="PEOPLE">People</MenuItem>
              <MenuItem value="COMPANY">Company</MenuItem>
            </TextField>
          </SectionContainer>
          <SectionContainer
            focussed={selectedContainer === 3}
            onClick={() => setSelectedContainer(3)}
            className={styles.SpacedContainer}
          >
            {Object.keys(form.search.params).map((param) => (
              <TextField
                key={param}
                name={`search.params.${param}`}
                label={
                  param.charAt(0).toUpperCase() +
                  param
                    .replace(/([A-Z])/g, " $1")
                    .slice(1)
                    .toLowerCase()
                }
                onChange={handleChange}
                onBlur={handleBlur}
                value={values.search.params[param]}
                error={Boolean(errors.search?.params?.[param])}
                helperText={errors.search?.params?.[param]}
                fullWidth
              />
            ))}
          </SectionContainer>
          <SectionContainer
            focussed={selectedContainer === 4}
            className={styles.SpacedContainer}
            onClick={() => setSelectedContainer(4)}
          >
            <TextField
              name="numOfResults"
              label="No. of results to get"
              onChange={handleChange}
              onBlur={handleBlur}
              value={values.numOfResults}
              error={Boolean(errors.numOfResults)}
              helperText={errors.numOfResults}
              type="number"
              required
            />
            <div className={styles.CheckboxContainer}>
              <FormLabel>Research Website?</FormLabel>
              <FormControlLabel
                control={
                  <Checkbox
                    name="researchWebsite"
                    checked={values.researchWebsite}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                }
                label="Yes"
              />
            </div>
            <div className={styles.CheckboxContainer}>
              <FormLabel>Save to Google?</FormLabel>
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
          <Divider className={styles.Divider} />
          <div className={styles.ButtonContainer}>
            <Button onClick={handleSubmit}>Submit</Button>
            {result.length > 0 && (
              <Button
                onClick={() => {
                  const encodedUri = encodeURI(
                    "Title,Overview,Industry,Founded,Phone,Website,Headquarters,Type\n" +
                      result.reduce((r, data) => {
                        for (let column of [
                          "title",
                          "overview",
                          "industry",
                          "founded",
                          "phone",
                          "website",
                          "headquarters",
                          "type",
                        ]) {
                          r += '"' + (data[column] || "") + '",';
                        }

                        r += "\n";

                        return r;
                      }, "")
                  );

                  var hiddenElement = document.createElement("a");
                  hiddenElement.href =
                    "data:text/csv;charset=utf-8," + encodedUri;
                  hiddenElement.target = "_blank";
                  hiddenElement.download = "linkedInData.csv";
                  hiddenElement.click();
                }}
              >
                Download data
              </Button>
            )}
            <Button
              onClick={() => {
                copySearch([
                  values.search.term,
                  values.search.params.location,
                  values.search.params.industry,
                  values.search.params.companySize &&
                    values.search.params.companySize + " employees",
                ]);
              }}
              color="inherit"
            >
              Copy Search (For Google Sheets)
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
};

export default GetLinkedInLeads;
