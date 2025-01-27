import { action, computed, observable } from "mobx";
import _, { fromPairs, flatten } from "lodash";
import moment from "moment";
import { NotificationManager } from "react-notifications";
import XLSX from "xlsx";
import axios from "axios";
import {
  encodeData,
  groupEntities,
  isTracker,
  programUniqueAttribute,
  programUniqueColumn,
} from "../utils/utils";
import Param from "./Param";
import OrganisationUnit from "./OrganisationUnit";
import ProgramWorker from "workerize-loader?inline!./Workers"; // eslint-disable-line import/no-webpack-loader-syntax
import { generateUid } from "../utils/uid";

let instance = new ProgramWorker();

class Program {
  @observable lastUpdated;
  @observable name;
  @observable id;
  @observable programType;
  @observable displayName;
  @observable programStages = [];
  @observable categoryCombo;
  @observable programTrackedEntityAttributes = [];
  @observable trackedEntityType;
  @observable trackedEntity;
  @observable mappingId = generateUid();
  @observable running = false;

  @observable orgUnitColumn = "";
  @observable orgUnitStrategy = {
    value: "auto",
    label: "auto",
  };
  @observable organisationUnits = [];

  @observable headerRow = 1;
  @observable dataStartRow = 2;

  @observable createNewEnrollments = false;

  @observable createEntities = false;
  @observable updateEntities = true;

  @observable enrollmentDateColumn = "";
  @observable incidentDateColumn = "";

  @observable url = "";
  @observable dateFilter = "";
  @observable dateEndFilter = "";
  @observable lastRun = "";

  @observable uploaded = 0;
  @observable uploadMessage = "";

  @observable page = 0;
  @observable rowsPerPage = 5;
  @observable dialogOpen = false;

  @observable paging = {
    nel: {
      page: 0,
      rowsPerPage: 10,
    },
    nte: {
      page: 0,
      rowsPerPage: 10,
    },
    nev: {
      page: 0,
      rowsPerPage: 10,
    },
    teu: {
      page: 0,
      rowsPerPage: 10,
    },
    evu: {
      page: 0,
      rowsPerPage: 10,
    },
    err: {
      page: 0,
      rowsPerPage: 10,
    },
    con: {
      page: 0,
      rowsPerPage: 10,
    },
    dup: {
      page: 0,
      rowsPerPage: 10,
    },
  };

  @observable orderBy = "mandatory";
  @observable order = "desc";
  @observable attributesFilter = "";

  @observable trackedEntityInstances = [];
  @observable d2;
  @observable fetchingEntities = 0;

  @observable responses = [];

  @observable increment = 0;

  @observable errors = [];
  @observable conflicts = [];
  @observable duplicates = [];

  @observable longitudeColumn;
  @observable latitudeColumn;

  @observable pulling = false;

  @observable workbook = null;

  @observable selectedSheet = null;

  @observable pulledData = null;

  @observable sheets = [];

  @observable dataSource = "xlsx";

  @observable scheduleTime = 0;

  @observable percentages = [];

  @observable total = 0;
  @observable displayProgress = false;

  @observable username = "";
  @observable password = "";
  @observable params = [];
  @observable responseKey = "";
  @observable fileName;
  @observable mappingName;
  @observable mappingDescription;
  @observable templateType;
  @observable sourceOrganisationUnits = [];
  @observable message = "";
  @observable incidentDateProvided = false;
  @observable processed;
  @observable data = [];
  @observable isUploadingFromPage;

  @observable selectIncidentDatesInFuture;
  @observable selectEnrollmentDatesInFuture;
  @observable isDHIS2 = false;
  @observable attributes = true;
  @observable remotePrograms = [];
  @observable remoteProgram = {};
  @observable remoteId = "";

  @observable trackedEntityInstances = true;
  @observable enrollments = true;
  @observable events = false;

  @observable remoteStage = null;
  @observable remoteTrackedEntityTypes = {};

  constructor(
    lastUpdated,
    name,
    id,
    programType,
    displayName,
    programStages,
    programTrackedEntityAttributes
  ) {
    this.lastUpdated = lastUpdated;
    this.name = name;
    this.id = id;
    this.programType = programType;
    this.displayName = displayName;
    this.programStages = programStages;
    this.programTrackedEntityAttributes = programTrackedEntityAttributes;
  }

  @action setDialogOpen = (val) => (this.dialogOpen = val);
  @action openDialog = () => this.setDialogOpen(true);
  @action closeDialog = () => this.setDialogOpen(false);
  @action setRemotePrograms = (val) => (this.remotePrograms = val);
  @action setRemoteProgram = (val) => (this.remoteProgram = val);
  @action setRemoteTrackedEntityTypes = (val) =>
    (this.remoteTrackedEntityTypes = val);

  @action handleTrackedEntityInstances = (event) => {
    this.trackedEntityInstances = event.target.checked;
  };

  @action handleErollments = (event) => {
    this.enrollments = event.target.checked;
  };

  @action handleEvents = (event) => {
    this.events = event.target.checked;
  };

  @action fromDHIS2 = async () => {
    if (this.url && this.username && this.password) {
      const { data } = await axios.get(`${this.url}/api/programs.json`, {
        params: {
          paging: false,
          fields: "id,name",
        },
        withCredentials: true,
        auth: {
          username: this.username,
          password: this.password,
        },
      });
      this.setRemotePrograms(
        data.programs.map(({ id, name }) => {
          return {
            label: name,
            value: id,
          };
        })
      );
    }
  };

  @action handleIsDHIS2 = async (event) => {
    this.isDHIS2 = event.target.checked;

    if (this.isDHIS2) {
      await this.fromDHIS2();
    }
  };

  @action handleRemoteProgramChange = async (program) => {
    this.remoteId = program;
    if (program) {
      const { data } = await axios.get(
        `${this.url}/api/programs/${program.value}.json`,
        {
          params: {
            fields:
              "id,name,programType,trackedEntityType,trackedEntity,programTrackedEntityAttributes[trackedEntityAttribute[id,code,name]],programStages[id,name,programStageDataElements[dataElement[id,code,name]]],organisationUnits[id,code,name]",
          },
          withCredentials: true,
          auth: {
            username: this.username,
            password: this.password,
          },
        }
      );
      this.setRemoteProgram(data);
    }
  };

  @action handleRemoteProgramStageChange = async (program) => {
    this.remoteStage = program;
  };

  @action
  setD2 = (d2) => {
    this.d2 = d2;
  };

  @action
  toggleDataPull() {
    this.dataPulled = !this.dataPulled;
  }

  @action
  handelHeaderRowChange = (value) => {
    this.headerRow = value;
    if (value) {
      this.handelDataRowStartChange(parseInt(value, 10) + 1);
    } else {
      this.handelDataRowStartChange("");
    }
  };

  @action
  handleMappingNameChange = (value) => {
    this.mappingName = value;
  };

  @action
  handleMappingDescriptionChange = (value) => {
    this.mappingDescription = value;
  };

  @action
  handelDataRowStartChange = (value) => (this.dataStartRow = value);

  @action
  handelScheduleTimeChange = (value) => (this.scheduleTime = value);

  @action pushPercentage = (val) =>
    (this.percentages = [...this.percentages, val]);

  @action
  handleOrgUnitSelectChange = (value) => {
    this.orgUnitColumn = value;
    this.computeUnits();
  };

  @action
  handleOrgUnitStrategySelectChange = (value) => (this.orgUnitStrategy = value);

  @action
  handleCreateNewEnrollmentsCheck = (event) => {
    this.createNewEnrollments = event.target.checked;

    if (!this.createNewEnrollments) {
      this.enrollmentDateColumn = null;
      this.incidentDateColumn = null;
    }
  };

  @action
  handleIncidentDateProvidedCheck = (event) => {
    this.incidentDateProvided = event.target.checked;
  };

  @action
  handleChangeElementPage = (what) => (event, page) => {
    const current = this.paging[what];
    const change = {};
    if (current) {
      change.page = page;
      change.rowsPerPage = current.rowsPerPage;
      const data = _.fromPairs([[what, change]]);

      const p = {
        ...this.paging,
        ...data,
      };

      this.setPaging(p);
    }
  };

  @action
  handleChangeElementRowsPerPage = (what) => (event) => {
    const current = this.paging[what];
    const change = {};
    if (current) {
      change.rowsPerPage = event.target.value;
      change.page = current.page;
      const data = _.fromPairs([[what, change]]);
      const p = {
        ...this.paging,
        ...data,
      };

      this.setPaging(p);
    }
  };

  @action
  handleCreateEntitiesCheck = (event) => {
    this.createEntities = event.target.checked;
  };

  @action
  handleUpdateEntitiesCheck = (event) => {
    this.updateEntities = event.target.checked;
  };

  @action
  handleEventDateColumnSelectChange = (value) => (this.eventDateColumn = value);

  @action
  handleEnrollmentDateColumnSelectChange = (value) => {
    this.enrollmentDateColumn = value;
  };

  @action
  handleIncidentDateColumnSelectChange = (value) =>
    (this.incidentDateColumn = value);

  @action
  handelURLChange = (value) => (this.url = value);

  @action
  handelDateFilterChange = (value) => (this.dateFilter = value);

  @action
  handelDateEndFilterChange = (value) => (this.dateEndFilter = value);

  @action
  handelScheduleChange = (value) => (this.schedule = value.target.value);

  @action
  scheduleTypeChange = () =>
    action((value) => {
      this.scheduleType = value.value;
    });

  @action addParam = () => {
    this.params = [...this.params, new Param()];
  };

  @action removeParam = (i) => () => {
    const current = [...this.params.slice(0, i), ...this.params.slice(i + 1)];
    this.setParams(current);
  };

  @action setDataSource = (val) => (this.dataSource = val);

  @action
  onDrop = async (accepted, rejected) => {
    if (accepted.length > 0) {
      this.openDialog();
      this.message = "Uploading";
      const f = accepted[0];
      this.setFileName();
      this.setDataSource(String(f.name).split(".").pop());
      const workbook = await instance.expensive(accepted);
      this.setWorkbook(workbook);
      const sheets = this.workbook.SheetNames.map((s) => {
        return {
          label: s,
          value: s,
        };
      });
      this.setSheets(sheets);

      if (sheets.length > 0) {
        await this.setSelectedSheet(sheets[0]);
      }
      this.closeDialog();
    } else if (rejected.length > 0) {
      NotificationManager.error(
        "Only XLS, XLSX and CSV are supported",
        "Error",
        5000
      );
    }
  };

  @action pullData = async () => {
    this.setDataSource("api");

    if (this.url) {
      this.openDialog();
      try {
        let response;
        if (this.isDHIS2) {
        } else {
          let param = "";
          if (this.params.length > 0) {
            param = encodeData(this.params);
          }

          if (this.username !== "" && this.password !== "") {
            this.setPulling(true);
            response = await axios.get(
              param !== "" ? this.url + "?" + param : this.url,
              {
                withCredentials: true,
                auth: {
                  username: this.username,
                  password: this.password,
                },
              }
            );
          } else {
            response = await axios.get(this.url + "?" + param);
          }
          if (response.status === 200) {
            let { data } = response;
            if (this.responseKey && this.responseKey !== "") {
              this.setData(data[this.responseKey]);
            } else {
              this.setData(data);
            }
          }
        }
      } catch (e) {
        NotificationManager.error(`${e.message || ""}`, "Error", 5000);
        this.closeDialog();
      }
      this.closeDialog();
    }
  };

  @action
  onProgress = (ev) => {
    this.uploaded = (ev.loaded * 100) / ev.total;
  };

  @action
  setPulling = (val) => (this.pulling = val);

  @action
  handleChangePage = (event, page) => (this.page = page);

  @action
  handleChangeRowsPerPage = (event) => (this.rowsPerPage = event.target.value);

  @action createSortHandler = (property) => (event) => {
    const orderBy = property;
    let order = "desc";

    if (this.orderBy === property && this.order === "desc") {
      order = "asc";
    }
    this.setOrderBy(orderBy);
    this.setOrder(order);
  };

  @action setOrder = (val) => (this.order = val);
  @action setOrderBy = (val) => (this.orderBy = val);
  @action setOrganisationUnits = (val) => (this.organisationUnits = val);
  @action setOrgUnitStrategy = (val) => (this.orgUnitStrategy = val);
  @action setHeaderRow = (val) => (this.headerRow = val);
  @action setDataStartRow = (val) => (this.dataStartRow = val);
  @action setCreateNewEnrollments = (val) => (this.createNewEnrollments = val);
  @action setEnrollmentDateColumn = (val) => (this.enrollmentDateColumn = val);
  @action setIncidentDateColumn = (val) => (this.incidentDateColumn = val);
  @action setUrl = (val) => (this.url = val);
  @action setDateFilter = (val) => (this.dateFilter = val);
  @action setDateEndFilter = (val) => (this.dateEndFilter = val);
  @action setScheduleTime = (val) => (this.scheduleTime = val);
  @action setLastRun = (val) => (this.lastRun = val);
  @action setUploaded = (val) => (this.uploaded = val);
  @action setUploadMessage = (val) => (this.uploadMessage = val);
  @action setOrgUnitColumn = (val) => (this.orgUnitColumn = val);
  @action setMappingId = (val) => (this.mappingId = val);
  @action setErrors = (val) => (this.errors = val);
  @action setConflicts = (val) => (this.conflicts = val);
  @action setDuplicates = (val) => (this.duplicates = val);
  @action setLongitudeColumn = (val) => (this.longitudeColumn = val);
  @action setLatitudeColumn = (val) => (this.latitudeColumn = val);
  @action setMessage = (val) => (this.message = val);
  @action setIsUploadingFromPage = (val) => (this.isUploadingFromPage = val);
  @action setCategoryCombo = (val) => (this.categoryCombo = val);
  @action setSelectIncidentDatesInFuture = (val) =>
    (this.selectIncidentDatesInFuture = val);
  @action setSelectEnrollmentDatesInFuture = (val) =>
    (this.selectEnrollmentDatesInFuture = val);
  @action setSelectedSheet = async (val) => {
    this.selectedSheet = val;
    if (val) {
      this.setProcessed(null);
      const data = XLSX.utils.sheet_to_json(this.workbook.Sheets[val.value], {
        header: 1,
        defval: "",
        raw: false,
        rawNumbers: false,
      });
      this.setData(data);
      this.computeUnits();
      if (this.isUploadingFromPage) {
        this.process();
      }
    }
  };
  @action setWorkbook = (val) => (this.workbook = val);
  @action setSheets = (val) => (this.sheets = val);
  @action setFetchingEntities = (val) => (this.fetchingEntities = val);
  @action setPulledData = (val) => (this.pulledData = val);
  @action setResponse = (val) => (this.responses = [...this.responses, val]);
  @action setDisplayProgress = (val) => (this.displayProgress = val);
  @action setTrackedEntity = (val) => (this.trackedEntity = val);
  @action setTrackedEntityType = (val) => (this.trackedEntityType = val);
  @action setRunning = (val) => (this.running = val);
  @action setUpdateEnrollments = (val) => (this.updateEnrollments = val);
  @action setCreateEntities = (val) => (this.createEntities = val);
  @action setUpdateEntities = (val) => (this.updateEntities = val);
  @action setTrackedEntityInstances = (val) =>
    (this.trackedEntityInstances = val);
  @action setPaging = (val) => (this.paging = val);
  @action setUsername = (val) => (this.username = val);
  @action setPassword = (val) => (this.password = val);
  @action setParams = (val) => (this.params = val);
  @action setResponseKey = (val) => (this.responseKey = val);
  @action setFileName = (val) => (this.fileName = val);
  @action setMappingName = (val) => (this.mappingName = val);
  @action setMappingDescription = (val) => (this.mappingDescription = val);
  @action setTemplateType = (val) => (this.templateType = val);
  @action setSourceOrganisationUnit = (val) =>
    (this.sourceOrganisationUnits = val);
  @action setIncidentDateProvided = (val) => (this.incidentDateProvided = val);
  @action setProcessed = (val) => (this.processed = val);
  @action setData = (val) => (this.data = val);

  @action
  filterAttributes = (attributesFilter) => {
    attributesFilter = attributesFilter.toLowerCase();
    this.attributesFilter = attributesFilter;
  };

  searchTrackedEntities = async () => {
    const api = this.d2.Api.getApi();

    let foundEntities = [];
    try {
      if (this.uniqueIds.length > 0) {
        const chunked = _.chunk(this.uniqueIds, 250);
        for (const ch of chunked) {
          let { trackedEntityInstances } = await api.get(
            "trackedEntityInstances.json",
            {
              attribute: `${this.uniqueAttribute}:IN:${ch.join(";")}`,
              ouMode: "ALL",
              trackedEntityType: this.trackedEntityType.id,
              skipPaging: true,
              fields: "*",
            }
          );
          foundEntities = [...foundEntities, ...trackedEntityInstances];
        }
        return foundEntities;
      }
    } catch (e) {
      NotificationManager.error(e.message, "Error", 5000);
    }
  };

  @action
  insertTrackedEntityInstance = (data) => {
    const api = this.d2.Api.getApi();
    return api.post("trackedEntityInstances", data, {});
  };

  @action
  updateTrackedEntityInstances = (trackedEntityInstances) => {
    const api = this.d2.Api.getApi();
    return trackedEntityInstances.map((trackedEntityInstance) => {
      return api.update(
        "trackedEntityInstances/" +
          trackedEntityInstance["trackedEntityInstance"],
        trackedEntityInstance,
        {}
      );
    });
  };

  @action
  insertEnrollment = (data) => {
    const api = this.d2.Api.getApi();
    return api.post("enrollments", data, {});
  };

  @action
  insertEvent = (data) => {
    const api = this.d2.Api.getApi();
    return api.post("events", data, {});
  };

  @action
  updateDHISEvents = (eventsUpdate) => {
    const api = this.d2.Api.getApi();
    return eventsUpdate.map((event) => {
      return api.update("events/" + event.event, event, {});
    });
  };

  @action setResponses = (val) => {
    if (Array.isArray(val)) {
      this.responses = [...this.responses, ...val];
    } else {
      this.responses = [...this.responses, val];
    }
  };

  @action insertData = async (openDialog = true) => {
    if (openDialog) {
      this.openDialog();
    }
    const {
      newTrackedEntityInstances,
      newEnrollments,
      newEvents,
      trackedEntityInstancesUpdate,
      eventsUpdate,
    } = this.processed;
    try {
      if (newTrackedEntityInstances && newTrackedEntityInstances.length > 0) {
        const chunkedTEI = _.chunk(newTrackedEntityInstances, 2000);
        const total = newTrackedEntityInstances.length;
        let current = 0;
        this.setMessage(`Creating tracked entities ${current}/${total}`);

        for (const tei of chunkedTEI) {
          current = current + tei.length;
          this.setMessage(`Creating tracked entities ${current}/${total}`);
          try {
            const instancesResults = await this.insertTrackedEntityInstance({
              trackedEntityInstances: tei,
            });
            instancesResults.type = "trackedEntityInstance";
            this.setResponses(instancesResults);
          } catch (error) {}
        }
        this.setMessage("Finished creating tracked entities");
      }

      if (
        trackedEntityInstancesUpdate &&
        trackedEntityInstancesUpdate.length > 0
      ) {
        const total = trackedEntityInstancesUpdate.length;
        let current = 0;
        this.setMessage(`Updating tracked entities ${current}/${total}`);
        const chunkedTEI = _.chunk(trackedEntityInstancesUpdate, 2000);
        for (const tei of chunkedTEI) {
          current = current + tei.length;
          this.setMessage(`Updating tracked entities ${current}/${total}`);
          try {
            const instancesResults = await this.insertTrackedEntityInstance({
              trackedEntityInstances: tei,
            });
            instancesResults.type = "trackedEntityInstance";
            this.setResponses(instancesResults);
          } catch (error) {}
        }
        this.setMessage("Finished updating tracked entities");
      }

      if (newEnrollments && newEnrollments.length > 0) {
        const total = newEnrollments.length;
        let current = 0;
        this.setMessage(
          `Creating enrollments for tracked entities ${current}/${total}`
        );
        const chunkedEnrollments = _.chunk(newEnrollments, 2000);
        for (const enrollments of chunkedEnrollments) {
          current = current + enrollments.length;
          this.setMessage(
            `Creating enrollments for tracked entities ${current}/${total}`
          );
          try {
            const enrollmentsResults = await this.insertEnrollment({
              enrollments: enrollments,
            });
            enrollmentsResults.type = "enrollment";
            this.setResponses(enrollmentsResults);
          } catch (error) {}
        }
        this.setMessage("Finished creating enrollments for tracked entities");
      }

      if (newEvents && newEvents.length > 0) {
        const total = newEvents.length;
        let current = 0;
        this.setMessage(`Creating events ${current}/${total}`);
        const chunkedEvents = _.chunk(newEvents, 2000);

        for (const events of chunkedEvents) {
          current = current + events.length;
          this.setMessage(`Creating events ${current}/${total}`);
          try {
            const eventsResults = await this.insertEvent({
              events,
            });
            eventsResults.type = "event";
            this.setResponses(eventsResults);
          } catch (error) {}
        }
        this.setMessage("Finished creating events");
      }

      if (eventsUpdate && eventsUpdate.length > 0) {
        const total = eventsUpdate.length;
        let current = 0;
        this.setMessage(`Updating events ${current}/${total}`);
        const chunkedEvents = _.chunk(eventsUpdate, 2000);
        for (const events of chunkedEvents) {
          current = current + events.length;
          this.setMessage(`Updating events ${current}/${total}`);
          try {
            const eventsResults = await Promise.all(
              this.updateDHISEvents(events)
            );
            this.setResponses(eventsResults);
          } catch (error) {}
        }
        this.setMessage("Finished updating events");
      }
      this.setPulledData(null);
      this.setWorkbook(null);
      await this.setSelectedSheet(null);
      this.setMessage("");
      if (openDialog) {
        this.closeDialog();
      }
    } catch (e) {
      this.setResponses(e);
      if (openDialog) {
        this.closeDialog();
      }
    }
  };

  @action create = async () => {
    if (this.isDHIS2) {
      this.setDataSource("api");
      const {
        programTrackedEntityAttributes,
        programStages,
        trackedEntityType,
        trackedEntity,
        id,
      } = this.remoteProgram;
      const stage = programStages.find((s) => s.id === this.remoteStage.value);
      const calculatedAttributes = fromPairs(
        programTrackedEntityAttributes.map((ptea) => [
          ptea.trackedEntityAttribute.name,
          "",
        ])
      );

      let tei = [];
      let page = 1;
      this.openDialog();
      do {
        let params = {
          ouMode: "ALL",
          fields: "*",
          pageSize: 250,
          page,
        };

        if (trackedEntityType) {
          params = { ...params, trackedEntityType: trackedEntityType.id };
        } else if (trackedEntity) {
          params = { ...params, trackedEntity: trackedEntity.id };
        } else {
          params = { ...params, program: id };
        }

        const {
          data: { trackedEntityInstances },
        } = await axios.get(`${this.url}/api/trackedEntityInstances.json`, {
          withCredentials: true,
          params,
          auth: {
            username: this.username,
            password: this.password,
          },
        });
        const instances = trackedEntityInstances.map(
          ({
            attributes,
            enrollments,
            relationships,
            notes,
            programOwners,
            ...instance
          }) => {
            const identifies = {
              ...instance,
            };
            const attr = {
              ...calculatedAttributes,
              ...fromPairs(
                attributes.map(({ displayName, value }) => [displayName, value])
              ),
            };
            const enrolls = enrollments
              .filter((e) => e.program === id && e.status === "ACTIVE")
              .map(
                ({
                  events,
                  notes,
                  programStage,
                  relationships,
                  enrollmentDate,
                  incidentDate,
                  program,
                  attributes,
                  ...ens
                }) => {
                  return events
                    .filter((e) => e.programStage === this.remoteStage.value)
                    .map(
                      ({
                        dataValues,
                        programStage,
                        orgUnit: eventOrgUnit,
                        relationships,
                        notes,
                        eventDate,
                        ...eves
                      }) => {
                        const calculatedElements = stage.programStageDataElements.map(
                          (psde) => {
                            const currentElement = dataValues.find(
                              (dv) => dv.dataElement === psde.dataElement.id
                            );

                            if (currentElement) {
                              return [
                                psde.dataElement.name,
                                currentElement.value,
                              ];
                            }

                            return [psde.dataElement.name, ""];
                          }
                        );
                        return {
                          ...ens,
                          programStage,
                          enrollmentDate: moment(
                            enrollmentDate,
                            "YYYY-MM-DD"
                          ).format("YYYY-MM-DD"),
                          incidentDate: moment(
                            incidentDate,
                            "YYYY-MM-DD"
                          ).format("YYYY-MM-DD"),
                          eventDate: moment(eventDate, "YYYY-MM-DD").format(
                            "YYYY-MM-DD"
                          ),
                          program,
                          eventOrgUnit,
                          ...identifies,
                          ...attr,
                          ...eves,
                          ...fromPairs(calculatedElements),
                        };
                      }
                    );
                }
              );
            return flatten(enrolls);
          }
        );
        this.setData(_.flatten(instances));
        await this.process(false);
        await this.insertData(false);
        tei = trackedEntityInstances;
        page = page + 1;
      } while (tei.length > 0);
      this.closeDialog();
    } else {
      await this.insertData();
    }
  };

  @action saveMapping = async () => {
    try {
      const namespace = await this.d2.dataStore.get("bridge");
      namespace.set(this.mappingId, this.canBeSaved);
    } catch (e) {
      NotificationManager.error(
        "Error",
        `Could not save mapping ${e.message}`,
        5000
      );
    }
  };

  @action deleteMapping = async () => {
    const api = this.d2.Api.getApi();
    await api.get(`dataStore/bridge/${this.mappingId}`);
  };

  @action scheduleProgram = () => {
    if (this.scheduleTime !== 0) {
      setInterval(
        action(async () => {
          if (!this.running) {
            this.setRunning(true);
            await this.pullData();
            await this.create();
            this.lastRun = moment(new Date()).format("YYYY-MM-DD HH:mm:ss");
            await this.saveMapping();
            this.setRunning(false);
          }
        }),
        this.scheduleTime * 60 * 1000
      );
    } else {
      console.log("Schedule time not set");
    }
  };

  @action runWhenURL = async () => {
    this.setRunning(true);
    this.pullData();
    this.create();
    this.lastRun = moment(new Date()).format("YYYY-MM-DD HH:mm:ss");
    await this.saveMapping();
  };

  @action runWithFile = () => {
    if (this.scheduleTime !== 0) {
      setInterval(
        action(() => {
          if (!this.running) {
            this.setRunning(true);
            this.pullData();
            this.create();
            this.lastRun = moment(new Date()).format("YYYY-MM-DD HH:mm:ss");
            this.saveMapping();
            this.setRunning(false);
          }
        }),
        this.scheduleTime * 60 * 1000
      );
    } else {
      console.log("Schedule time not set");
    }
  };

  @action loadDefaultAttributes = () => {
    if (this.updateEntities || this.createEntities) {
      this.programAttributes.forEach((pa) => {
        const match = this.columns.find((column) => {
          return column.value === pa.trackedEntityAttribute.name;
        });

        if (match && !pa.column) {
          pa.setColumn(match);
        }
      });
    }
  };

  @action
  searchedEvents = async () => {
    const { possibleEvents } = this.processed;
    let newEvents = [];
    let eventsUpdate = [];

    if (possibleEvents.length > 0 && !this.isTracker) {
      for (const event of possibleEvents) {
        const ev = await this.searchEvent(event);
        if (ev.update) {
          eventsUpdate = [...eventsUpdate, ev];
        } else {
          newEvents = [...newEvents, ev];
        }
      }
    }
  };

  @action computeUnits = () => {
    if (this.isDHIS2) {
      this.setOrgUnitColumn({ value: "orgUnitName", label: "orgUnitName" });
      const organisations = this.remoteProgram.organisationUnits.map((o) => {
        const ou = new OrganisationUnit(o.id, o.name, o.code);

        let findInPrevious = undefined;

        if (!findInPrevious) {
          findInPrevious = this.sourceOrganisationUnits.find(
            (su) => su.id === o.id
          );
        }

        if (!findInPrevious) {
          findInPrevious = this.sourceOrganisationUnits.find(
            (su) => su.code === o.code
          );
        }

        if (!findInPrevious) {
          findInPrevious = this.sourceOrganisationUnits.find(
            (su) => su.name === o.name
          );
        }
        if (findInPrevious) {
          ou.setMapping(findInPrevious.mapping);
        } else {
          let findInPrevious = undefined;
          if (!findInPrevious) {
            findInPrevious = this.organisationUnits.find(
              (su) => su.id === o.id
            );
          }

          if (!findInPrevious) {
            findInPrevious = this.organisationUnits.find(
              (su) => su.code === o.code
            );
          }

          if (!findInPrevious) {
            findInPrevious = this.organisationUnits.find(
              (su) => su.name === o.name
            );
          }

          if (findInPrevious) {
            ou.setMapping({
              label: findInPrevious.name,
              value: findInPrevious.id,
            });
          }
        }
        return ou;
      });
      this.setSourceOrganisationUnit(organisations);
    } else {
      if (
        this.orgUnitColumn &&
        this.realData.length > 0 &&
        _.keys(this.realData[0]).indexOf(this.orgUnitColumn.value) !== -1
      ) {
        let units = this.realData.map((d) => {
          return new OrganisationUnit("", d[this.orgUnitColumn.value], "");
        });

        units = _.uniqBy(units, (v) => JSON.stringify(v)).map((org) => {
          let findInPrevious = undefined;

          if (!findInPrevious) {
            findInPrevious = this.sourceOrganisationUnits.find(
              (su) => su.name === org.name
            );
          }

          if (findInPrevious) {
            org.setMapping(findInPrevious.mapping);
          } else {
            let foundOU = undefined;
            const foundOUById = _.find(this.organisationUnits, (o) => {
              return o.id === org.name;
            });
            if (foundOUById) {
              foundOU = foundOUById;
            } else {
              const foundOUByCode = _.find(this.organisationUnits, (o) => {
                return o.code === org.name;
              });

              if (foundOUByCode) {
                foundOU = foundOUByCode;
              } else {
                const foundOUByName = _.find(this.organisationUnits, (o) => {
                  return org.name === o.name;
                });

                if (foundOUByName) {
                  foundOU = foundOUByName;
                }
              }
            }
            if (foundOU) {
              org.setMapping({ label: foundOU.name, value: foundOU.id });
            }
          }
          return org;
        });
        this.setSourceOrganisationUnit(units);
      }
    }
  };

  @action process = async (openDialog = true) => {
    if (openDialog) {
      this.openDialog();
    }
    const program = JSON.parse(JSON.stringify(this.canBeSaved));
    const uniqueColumn = JSON.parse(JSON.stringify(this.uniqueColumn));
    const data = JSON.parse(JSON.stringify(this.withoutDuplicates));
    let dataResponse;
    if (this.isTracker) {
      this.setMessage("Fetching previous tracked entity instances");
      const searchedInstances = await this.searchTrackedEntities();

      const groupedEntities = groupEntities(
        this.uniqueAttribute,
        searchedInstances
      );
      this.setMessage("Processing selected tracker program...");
      dataResponse = await instance.processTrackerProgramData(
        data,
        program,
        uniqueColumn,
        groupedEntities
      );
    } else {
      const programStage = this.programStages[0];
      this.setMessage("Fetching previous events by date");
      const eventsData = await programStage.findEvents(this);
      this.setMessage("Processing selected event program...");
      dataResponse = await instance.processEventProgramData(
        program,
        data,
        eventsData
      );
    }
    this.setProcessed(dataResponse);
    if (openDialog) {
      this.closeDialog();
    }
  };

  @computed get withoutDuplicates() {
    if (this.realData) {
      if (!this.isTracker) {
        let filteredData = [];
        const programStage = this.programStages[0];
        if (
          programStage.elementsWhichAreIdentifies.length > 0 &&
          programStage.eventDateIdentifiesEvent
        ) {
          const grped = _.groupBy(this.realData, (v) => {
            const ele = programStage.elementsWhichAreIdentifies
              .map((e) => {
                return v[e.column.value];
              })
              .join("@");
            return `${ele}${moment(
              v[programStage.eventDateColumn.value]
            ).format("YYYY-MM-DD")}`;
          });
          _.forOwn(grped, (v) => {
            filteredData = [...filteredData, v[0]];
          });
          return filteredData;
        } else if (programStage.elementsWhichAreIdentifies.length) {
          const grped = _.groupBy(this.realData, (v) => {
            return programStage.elementsWhichAreIdentifies
              .map((e) => {
                return v[e.column.value];
              })
              .join("@");
          });
          _.forOwn(grped, (v) => {
            filteredData = [...filteredData, v[0]];
          });
          return filteredData;
        } else if (programStage.eventDateIdentifiesEvent) {
          const grped = _.groupBy(this.realData, (v) => {
            return moment(v[programStage.eventDateColumn.value]).format(
              "YYYY-MM-DD"
            );
          });
          _.forOwn(grped, (v) => {
            filteredData = [...filteredData, v[0]];
          });
          return filteredData;
        }
      }
      return this.realData;
    }
    return [];
  }

  @computed
  get disableCreate() {
    return this.totalImports === 0;
  }

  @computed
  get percentage() {
    return _.reduce(
      this.percentages,
      (memo, num) => {
        return memo + num;
      },
      0
    );
  }

  @computed
  get columns() {
    if (this.isDHIS2) {
      let cols = this.remoteProgram.programTrackedEntityAttributes.map((a) => {
        return {
          label: a.trackedEntityAttribute.name,
          value: a.trackedEntityAttribute.name,
        };
      });

      cols = [
        { label: "enrollmentDate", value: "enrollmentDate" },
        { label: "incidentDate", value: "incidentDate" },
        ...cols,
        { label: "eventDate", value: "eventDate" },
      ];

      if (this.events) {
        const stage = this.remoteProgram.programStages.find(
          (a) => a.id === this.remoteStage.value
        );

        const elements = stage.programStageDataElements.map((e) => {
          return {
            label: e.dataElement.name,
            value: e.dataElement.name,
          };
        });

        cols = [...cols, ...elements];
      }
      return cols;
    } else {
      if (
        this.data &&
        this.data.length > 0 &&
        this.headerRow &&
        this.dataSource !== "api"
      ) {
        return this.data[this.headerRow - 1].map((e) => {
          return {
            label: e,
            value: e,
          };
        });
      }
      if (this.data && this.data.length > 0 && this.dataSource === "api") {
        return Object.keys(this.data[0]).map((e) => {
          return {
            label: e,
            value: e,
          };
        });
      }
    }
    return [];
  }

  @computed
  get realData() {
    if (this.isDHIS2 || this.dataSource === "api") {
      return this.data;
    } else {
      return this.data.slice(this.dataStartRow - 1).map((d) => {
        return fromPairs(d.map((d, i) => [this.columns[i].value, d]));
      });
    }
  }

  @computed
  get canBeSaved() {
    return _.pick(this, [
      "lastUpdated",
      "name",
      "id",
      "programType",
      "displayName",
      "programStages",
      "programTrackedEntityAttributes",
      "trackedEntityType",
      "trackedEntity",
      "mappingId",
      "orgUnitColumn",
      "orgUnitStrategy",
      "organisationUnits",
      "headerRow",
      "dataStartRow",
      "updateEvents",
      "createNewEnrollments",
      "createEntities",
      "updateEntities",
      "eventDateColumn",
      "enrollmentDateColumn",
      "incidentDateColumn",
      "scheduleTime",
      "url",
      "dateFilter",
      "dateEndFilter",
      "lastRun",
      "uploaded",
      "uploadMessage",
      "dataSource",
      "username",
      "password",
      "responseKey",
      "params",
      "longitudeColumn",
      "latitudeColumn",
      "selectedSheet",
      "mappingName",
      "mappingDescription",
      "sourceOrganisationUnits",
      "templateType",
      "incidentDateProvided",
      "categoryCombo",
      "selectIncidentDatesInFuture",
      "selectEnrollmentDatesInFuture",
      "isDHIS2",
      "trackedEntityInstances",
      "enrollments",
      "events",
      "remoteStage",
      "remoteId",
      "remoteProgram",
    ]);
  }

  @computed
  get processedResponses() {
    let errors = [];
    let conflicts = [];
    let successes = [];

    this.responses.forEach((response) => {
      const type = response.type;
      if (response["httpStatusCode"] === 200) {
        const rep = response["response"];
        const { importSummaries, importCount } = rep;

        if (importCount) {
          successes = [
            ...successes,
            {
              ...importCount,
              type: "Event",
              reference: rep.reference,
            },
          ];
        } else if (importSummaries) {
          importSummaries.forEach((importSummary) => {
            const { importCount, reference } = importSummary;
            successes = [
              ...successes,
              {
                ...importCount,
                type,
                reference,
              },
            ];
          });
        }
      } else if (response["httpStatusCode"] === 409) {
        const { message, importSummaries } = response["response"];
        if (importSummaries) {
          _.forEach(importSummaries, (s) => {
            _.forEach(s["conflicts"], (conflict) => {
              conflicts = [
                ...conflicts,
                {
                  ...conflict,
                },
              ];
            });
            if (s["href"]) {
              successes = [
                ...successes,
                {
                  href: s["href"],
                },
              ];
            }
          });
        }

        if (message) {
          conflicts = [
            ...conflicts,
            {
              message,
            },
          ];
        }
      } else if (response["httpStatusCode"] === 500) {
        errors = [
          ...errors,
          {
            ...response["error"],
          },
        ];
      }
    });
    const pro = _.groupBy(successes, "reference");

    let s = [];

    _.forOwn(pro, (d, k) => {
      const reduced = _.reduce(
        d,
        (result, value) => {
          result.updated = result.updated + value.updated;
          result.imported = result.imported + value.imported;
          result.deleted = result.deleted + value.deleted;
          return result;
        },
        { updated: 0, imported: 0, deleted: 0 }
      );

      reduced.type = d[0]["type"];
      reduced.reference = k;
      s = [...s, reduced];
    });

    return {
      errors,
      successes: s,
      conflicts,
    };
  }

  @computed
  get isTracker() {
    return isTracker(this);
  }

  @computed get allOrganisationUnits() {
    return _.fromPairs(this.organisationUnits.map((ou) => [ou.id, ou.name]));
  }

  @computed
  get programAttributes() {
    const sorter =
      this.order === "desc"
        ? (a, b) => (b[this.orderBy] < a[this.orderBy] ? -1 : 1)
        : (a, b) => (a[this.orderBy] < b[this.orderBy] ? -1 : 1);

    return this.programTrackedEntityAttributes
      .filter((item) => {
        const displayName = item.trackedEntityAttribute.displayName.toLowerCase();
        return displayName.includes(this.attributesFilter);
      })
      .sort(sorter)
      .slice(
        this.page * this.rowsPerPage,
        this.page * this.rowsPerPage + this.rowsPerPage
      );
  }

  @computed
  get allAttributes() {
    return this.programTrackedEntityAttributes.length;
  }

  @computed
  get uniqueAttribute() {
    return programUniqueAttribute(this);
  }

  @computed
  get uniqueColumn() {
    return programUniqueColumn(this);
  }

  @computed
  get uniqueIds() {
    if (
      this.uniqueColumn !== null &&
      this.realData &&
      this.realData.length > 0
    ) {
      let foundIds = this.realData
        .map((d) => {
          return d[this.uniqueColumn];
        })
        .filter((c) => {
          return c !== null && c !== undefined && c !== "";
        });
      foundIds = _.uniq(foundIds);
      return foundIds;
      // return _.chunk(foundIds, 50).map(ids => ids.join(';'));
    }
    return [];
  }

  @computed
  get searchedInstances() {
    return groupEntities(this.uniqueAttribute, this.trackedEntityInstances);
  }

  @computed
  get mandatoryAttributesMapped() {
    const allMandatory = this.programTrackedEntityAttributes.filter((item) => {
      return item.mandatory && !item.column;
    });
    return allMandatory.length === 0;
  }

  @computed
  get compulsoryDataElements() {
    let compulsory = [];
    this.programStages.forEach((ps) => {
      const pse = ps.programStageDataElements
        .filter((item) => {
          return item.compulsory;
        })
        .map((e) => {
          return e.dataElement.id;
        });

      const me = ps.programStageDataElements
        .filter((item) => {
          return item.compulsory && item.column && item.column.value;
        })
        .map((e) => {
          return e.dataElement.id;
        });

      let mapped = false;

      if (me.length === 0) {
        mapped = true;
      } else if (
        (ps.createNewEvents || ps.updateEvents) &&
        pse.length > 0 &&
        me.length > 0 &&
        _.difference(pse, me).length === 0
      ) {
        mapped = true;
      } else if (
        (ps.createNewEvents || ps.updateEvents) &&
        pse.length > 0 &&
        me.length > 0 &&
        _.difference(pse, me).length > 0
      ) {
        mapped = false;
      }
      compulsory = [
        ...compulsory,
        {
          mapped,
        },
      ];
    });
    return _.every(compulsory, "mapped");
  }

  @computed get processedAttributes() {
    const data = this.programTrackedEntityAttributes.map((item) => {
      return [
        item.trackedEntityAttribute.id,
        item.trackedEntityAttribute.displayName,
      ];
    });
    return _.fromPairs(data);
  }

  @computed get processedDataElements() {
    let finalDataElements = [];

    for (const stage of this.programStages) {
      for (const element of stage.programStageDataElements) {
        finalDataElements = [
          ...finalDataElements,
          [element.dataElement.id, element.dataElement.name],
        ];
      }
    }
    return _.fromPairs(finalDataElements);
  }

  @computed get currentNewInstances() {
    if (this.processed) {
      const { newTrackedEntityInstances } = this.processed;

      return newTrackedEntityInstances.map((tei) => {
        const attributes = tei.attributes.map((a) => {
          return { ...a, name: this.processedAttributes[a.attribute] };
        });

        return {
          ...tei,
          attributes,
          orgUnit: this.allOrganisationUnits[tei.orgUnit],
        };
      });
    }
    return [];
  }

  @computed get allStages() {
    return _.fromPairs(this.programStages.map((s) => [s.id, s.name]));
  }

  @computed get currentNewEnrollments() {
    if (this.processed) {
      const { newEnrollments } = this.processed;

      return newEnrollments.map((e) => {
        return { ...e, orgUnit: this.allOrganisationUnits[e.orgUnit] };
      });
    }
    return [];
  }

  @computed get currentNewEvents() {
    if (this.processed) {
      const { newEvents } = this.processed;

      return newEvents.map((event) => {
        const dataValues = event.dataValues.map((e) => {
          return { ...e, name: this.processedDataElements[e.dataElement] };
        });

        return {
          ...event,
          dataValues,
          orgUnit: this.allOrganisationUnits[event.orgUnit],
          programStage: this.allStages[event.programStage],
        };
      });
    }
    return [];
  }

  @computed get currentInstanceUpdates() {
    if (this.processed) {
      const { trackedEntityInstancesUpdate } = this.processed;
      return trackedEntityInstancesUpdate.map((tei) => {
        const attributes = tei.attributes.map((a) => {
          return { ...a, name: this.processedAttributes[a.attribute] };
        });

        return {
          ...tei,
          attributes,
          orgUnit: this.allOrganisationUnits[tei.orgUnit],
        };
      });
    }
    return [];
  }

  @computed get currentEventUpdates() {
    if (this.processed) {
      const { eventsUpdate } = this.processed;

      return eventsUpdate.map((event) => {
        const dataValues = event.dataValues.map((e) => {
          return { ...e, name: this.processedDataElements[e.dataElement] };
        });

        return {
          ...event,
          dataValues,
          orgUnit: this.allOrganisationUnits[event.orgUnit],
          programStage: this.allStages[event.programStage],
        };
      });
    }
    return [];
  }

  @computed get currentErrors() {
    const { errors } = this.processed;

    const info = this.paging["err"];

    if (errors && errors.length > 0) {
      return errors.slice(
        info.page * info.rowsPerPage,
        info.page * info.rowsPerPage + info.rowsPerPage
      );
    }
    return [];
  }

  @computed get currentConflicts() {
    const { conflicts } = this.processed;

    const info = this.paging["con"];

    if (conflicts && conflicts.length > 0) {
      return conflicts.slice(
        info.page * info.rowsPerPage,
        info.page * info.rowsPerPage + info.rowsPerPage
      );
    }
    return [];
  }

  @computed get currentDuplicates() {
    const { duplicates } = this.processed;

    const info = this.paging["dup"];

    if (duplicates && duplicates.length > 0) {
      return duplicates.slice(
        info.page * info.rowsPerPage,
        info.page * info.rowsPerPage + info.rowsPerPage
      );
    }
    return [];
  }

  @computed get totalImports() {
    if (this.processed && !_.isEmpty(this.processed)) {
      const {
        newTrackedEntityInstances,
        newEnrollments,
        newEvents,
        trackedEntityInstancesUpdate,
        eventsUpdate,
      } = this.processed;

      if (this.isTracker) {
        return (
          newTrackedEntityInstances.length +
          newEnrollments.length +
          newEvents.length +
          trackedEntityInstancesUpdate.length +
          eventsUpdate.length
        );
      } else {
        return newEvents.length + eventsUpdate.length;
      }
    }
    return 0;
  }

  @computed get eventsByDataElement() {
    let data;
    const stage = this.programStages[0];

    for (const psde of stage.programStageDataElements) {
      data = { [psde.dataElement.id]: psde.dataElement.eventsByDataElement };
    }

    return data;
  }

  @computed get processedSummary() {
    if (this.processed) {
      const {
        newTrackedEntityInstances,
        newEnrollments,
        newEvents,
        trackedEntityInstancesUpdate,
        eventsUpdate,
        conflicts,
        duplicates,
        errors,
      } = this.processed;

      return {
        newTrackedEntityInstances,
        newEnrollments,
        newEvents,
        trackedEntityInstancesUpdate,
        eventsUpdate,
        conflicts,
        duplicates,
        errors,
      };
    }
    return {
      newTrackedEntityInstances: [],
      newEnrollments: [],
      newEvents: [],
      trackedEntityInstancesUpdate: [],
      eventsUpdate: [],
      conflicts: [],
      duplicates: [],
      errors: [],
    };
  }

  @computed get categories() {
    if (this.categoryCombo) {
      return this.categoryCombo.categories.map((category) => {
        return { label: category.name, value: category.id };
      });
    }
    return [];
  }

  @computed get stages() {
    if (this.remoteProgram) {
      return this.remoteProgram.programStages.map(({ id, name }) => {
        return { label: name, value: id };
      });
    }
    return [];
  }
}

export default Program;
