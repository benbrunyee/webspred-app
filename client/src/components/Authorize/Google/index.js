import React from "react";
import { Button } from "@material-ui/core";
import config from "../../../config";

const AuthorizeGoogle = (props) => {
  const { CLIENT_ID, AUTH_URI, SCOPE, REDIRECT_URI } = config.google;

  // Set the url with the details of this app but ensure that we have the ability to always select an account
  const params = `${AUTH_URI}?response_type=token&client_id=${CLIENT_ID}&scope=${SCOPE.join("%20")}&redirect_uri=${REDIRECT_URI}&prompt=select_account`;

  return (
    <a href={params}>
      <Button>Authorize Google</Button>
    </a>
  );
};

export default AuthorizeGoogle;
