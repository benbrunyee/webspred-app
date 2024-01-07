import React from "react";
import GetLinkedInLeads from "../../components/Forms/GetLinkedInLeads";
import Container from "../../components/UI/Container";
import { useNotificationDispatch } from "../../context/notifications";

const GetLinkedInLeadsRoute = () => {
  const notificationDispatcher = useNotificationDispatch();

  return (
    <Container>
      <GetLinkedInLeads notificationDispatcher={notificationDispatcher} />
    </Container>
  );
};

export default GetLinkedInLeadsRoute;
