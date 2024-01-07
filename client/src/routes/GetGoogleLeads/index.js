import React from "react";
import Container from "../../components/UI/Container";
import GetGoogleLeads from "../../components/Forms/GetGoogleLeads";
import { useNotificationDispatch } from "../../context/notifications";

const GetGoogleLeadsRoute = () => {
  const notificationDispatcher = useNotificationDispatch();
  return (
    <Container>
      <GetGoogleLeads {...{ notificationDispatcher }} />
    </Container>
  );
};

export default GetGoogleLeadsRoute;
