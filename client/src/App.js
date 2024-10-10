import { CircularProgress, Drawer, Typography } from "@material-ui/core";
import {
  createMuiTheme,
  makeStyles,
  MuiThemeProvider,
} from "@material-ui/core/styles";
import ContactPhoneIcon from "@material-ui/icons/ContactPhone";
import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";
import { Route, Switch } from "react-router";
import { NavLink } from "react-router-dom";
import "./App.scss";
import AuthorizeGoogle from "./components/Authorize/Google";
import CopyrightBanner from "./components/CopyrightBanner";
import NavBar from "./components/NavBar";
import NotificationDisplay from "./components/Notification";
import { Option, OptionGroup } from "./components/OptionGroup";
import PageView from "./components/Page";
import Router from "./components/Router";
import SideBar from "./components/Sidebar";
import { NotificationProvider } from "./context/notifications";
import UserDataContext from "./context/userData";
import { useViewport, ViewportProvider } from "./context/viewport";
import GetGoogleLeadsRoute from "./routes/GetGoogleLeads";
import GetLinkedInLeadsRoute from "./routes/GetLinkedInLeads";

const useStyles = makeStyles((theme) => {
  const { width } = useViewport();
  const drawerWidth = width < 600 ? 180 : 240;

  return {
    root: {
      display: "flex",
    },
    appBar: {
      marginLeft: 0,
      width: "100%",
      transition: theme.transitions.create(["margin", "width"], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
    },
    appBarShift: {
      width: `calc(100% - ${drawerWidth}px)`,
      marginLeft: drawerWidth,
      transition: theme.transitions.create(["margin", "width"], {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
    },
    menuButton: {
      marginRight: theme.spacing(2),
    },
    hide: {
      display: "none",
    },
    drawer: {
      width: drawerWidth,
      flexShrink: 0,
    },
    drawerPaper: {
      width: drawerWidth,
    },
    drawerHeader: {
      display: "flex",
      alignItems: "center",
      padding: theme.spacing(0, 1),
      // necessary for content to be below app bar
      ...theme.mixins.toolbar,
      justifyContent: "flex-end",
    },
    content: {
      height: "100%",
      transition: theme.transitions.create("margin", {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
      marginLeft: 50,
      overflowY: "scroll",
    },
    contentShift: {
      transition: theme.transitions.create("margin", {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
      marginLeft: drawerWidth,
    },
    switchContainer: {
      textAlign: "center",
      bottom: "10px",
      position: "absolute",
      width: "100%",
    },
    AuthorizeGoogle: {
      textAlign: "center",
    },
    Loader: {
      margin: "auto",
    },
  };
});

const theme = createMuiTheme({
  palette: {
    primary: {
      main: "#59CAF3",
    },
    warning: {
      main: "#E50000",
    },
    type: "light",
  },
  typography: {
    fontFamily: "Poppins, sans-serif",
    fontWeightMedium: "normal",
  },
  overrides: {
    MuiTextField: {
      root: {
        minWidth: 150,
      },
    },
    MuiButton: {
      root: {
        textTransform: "none",
      },
    },
    MuiTab: {
      root: {
        textTransform: "none",
      },
    },
    MuiSelect: {
      select: {
        "&:focus": {
          backgroundColor: "none",
        },
      },
    },
    MuiPaper: {
      rounded: {
        borderRadius: 5,
      },
    },
    MuiToolbar: {
      root: {
        borderRadius: 5,
      },
    },
    MuiPopover: {
      paper: {
        borderRadius: "30px 0 0 30px",
        overflowY: "scroll",
      },
    },
    MuiTableRow: {
      root: {
        "&$selected, &$selected:hover": {
          backgroundColor: "rgba(99, 32, 238, 0.1)",
        },
      },
    },
    MuiLinearProgress: {
      root: {
        borderRadius: 5,
      },
    },
  },
  props: {
    MuiButton: {
      variant: "contained",
      color: "primary",
    },
    MuiDialog: {
      PaperProps: {
        style: {
          padding: 20,
          borderRadius: 5,
        },
      },
    },
    MuiAppBar: {
      style: {
        borderRadius: "5px 5px 0 0",
      },
    },
    MuiTextField: {
      variant: "outlined",
      color: "primary",
      size: "small",
    },
    MuiSelect: {
      variant: "outlined",
      color: "primary",
    },
    MuiRadio: {
      color: "primary",
    },
    MuiCheckbox: {
      color: "primary",
    },
  },
});

const App = () => {
  const classes = useStyles();
  const [open, setOpen] = useState(true);
  const [token, setToken] = useState({});
  const firstLoad = useRef(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (firstLoad.current) {
      // Set the google token, do nothing on error.
      window.ipcRenderer
        .invoke("getGoogleToken")
        .then((googleToken) => {
          setToken(googleToken);
          setLoading(false);
        })
        .catch((err) => {
          console.log(err);
        });
      firstLoad.current = false;
    }
  }, [firstLoad]);

  // Don't return the app until we have configured it first e.g. token
  if (loading) {
    return (
      <CircularProgress
        color="primary"
        disableShrink
        className={classes.Loader}
      />
    );
  }

  return (
    <div className="App">
      <ViewportProvider>
        <MuiThemeProvider theme={theme}>
          <UserDataContext.Provider value={{ token }}>
            <Router>
              <NotificationProvider>
                <NotificationDisplay />
                <Switch>
                  <Route exact path="/not-found">
                    <Typography>Page not found :(</Typography>
                  </Route>
                  <Route>
                    <PageView className={classes.root}>
                      <NavBar
                        open={open}
                        className={clsx(classes.appBar, {
                          [classes.appBarShift]: open,
                        })}
                        menuButtonClass={classes.menuButton}
                        hideClass={classes.hide}
                        toggleSideBar={() => setOpen(!open)}
                      />
                      <Drawer
                        className={classes.drawer}
                        variant={"persistent"}
                        anchor={"left"}
                        open={open}
                        classes={{
                          paper: classes.drawerPaper,
                        }}
                      >
                        <SideBar
                          toggleOpen={() => setOpen(!open)}
                          copyright={CopyrightBanner}
                        >
                          <OptionGroup heading={"Menu"}>
                            <NavLink
                              to={"/"}
                              isActive={(match, location) =>
                                location.pathname === "/"
                              }
                            >
                              <Option label={"Get Leads"}>
                                <ContactPhoneIcon />
                              </Option>
                            </NavLink>
                            <NavLink
                              to={"/linkedin-leads"}
                              isActive={(match, location) =>
                                location.pathname === "/linkedin-leads"
                              }
                            >
                              <Option label="LinkedIn Leads">
                                <ContactPhoneIcon />
                              </Option>
                            </NavLink>
                          </OptionGroup>
                          <div className={classes.AuthorizeGoogle}>
                            <AuthorizeGoogle />
                          </div>
                        </SideBar>
                      </Drawer>
                      <div
                        className={clsx(classes.content, {
                          [classes.contentShift]: open,
                        })}
                      >
                        <Switch>
                          <Route
                            exact
                            path="/"
                            component={GetGoogleLeadsRoute}
                          />
                        </Switch>
                        <Switch>
                          <Route
                            exact
                            path="/linkedin-leads"
                            component={GetLinkedInLeadsRoute}
                          />
                        </Switch>
                      </div>
                    </PageView>
                  </Route>
                </Switch>
              </NotificationProvider>
            </Router>
          </UserDataContext.Provider>
        </MuiThemeProvider>
      </ViewportProvider>
    </div>
  );
};

export default App;
