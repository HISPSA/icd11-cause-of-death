import "./index.css";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faNotesMedical,
  faUserEdit,
  faAngleDoubleUp,
  faAngleDoubleDown
} from "@fortawesome/free-solid-svg-icons";
import { Button, message } from 'antd';
import { DoubleLeftOutlined, DoubleRightOutlined } from '@ant-design/icons';
import { Backdrop, CircularProgress } from '@mui/material';

import { connect } from "react-redux";
import { useState, useEffect } from "react";

import DeathCertificate from "./DeathCertificate";
import Profile from "./Profile";
import Stage from "./Stage";
import Result from "./Result";

import WarningDialog from "./WarningDialog";
import DeleteDialog from "./DeleteDialog";

import { changeRoute } from "../../redux/actions/route";
import {
  mutateTei,
  mutateAttribute,
  mutateEnrollment,
  mutateEvent,
  mutateDataValue,
} from "../../redux/actions/data";

import { Hooks } from "tracker-capture-app-core";
import { generateDhis2Payload } from "../../utils";
import { useTranslation } from "react-i18next";
import { validateSAIdNumber } from "../../utils/saIdValidation";


const { useApi } = Hooks;
const ButtonGroup = Button.Group;

// Helper function to validate SA ID number
const validateSAIdBeforeSave = (currentTei, formMapping) => {
  if (currentTei.attributes[formMapping.attributes["identification_type"]] === "ID_TYPE_SA") {
    const saIdNumber = currentTei.attributes[formMapping.attributes["sa_id_number"]];
    
    // Check if SA ID number is provided
    if (!saIdNumber || saIdNumber.trim() === '') {
      message.error("SA ID number is required!");
      return false;
    }
    
    // Check if SA ID number is exactly 13 digits
    if (saIdNumber.length !== 13) {
      message.error("SA ID number must be exactly 13 digits!");
      return false;
    }
    
    // Check if SA ID number contains only digits
    if (!/^\d+$/.test(saIdNumber)) {
      message.error("SA ID number must contain only digits!");
      return false;
    }
    
    // Validate SA ID number format and checksum
    const validation = validateSAIdNumber(saIdNumber);
    if (!validation.isValid) {
      message.error(validation.error);
      return false;
    }
  }
  return true;
};

// Check if DORIS processing is required before Save/Complete
const checkDorisRequirement = (data, metadata) => {
  const { currentTei, currentEvents } = data;
  const { formMapping } = metadata;
  
  // Get current event
  const currentEvent = currentEvents.find((event) => {
    return event.programStage === formMapping.programStage;
  });
  
  // Check if age is 0-6 days (neonatal deaths)
  const currentTeiAgeAttributeValue = currentTei?.attributes[formMapping.attributes["age"]];
  const ageUnit = currentTei?.attributes[formMapping.attributes["age_unit"]];
  const ageValue = currentTei?.attributes[formMapping.attributes["estimated_age"]];
  
  if (currentTeiAgeAttributeValue && ageUnit && ageValue) {
    if (ageUnit.toLowerCase().includes("day")) {
      const ageInDays = parseInt(ageValue);
      if (ageInDays >= 0 && ageInDays <= 6) {
        return {
          required: true,
          reason: "neonatal",
          message: "Manual cause of death recommended for ages 0-6 days. DORIS tool will not work for neonatal deaths. Please select manual processing and provide a reason."
        };
      }
    }
  }
  
  // Check if DORIS was already successful
  const underlyingCode = currentEvent?.dataValues[formMapping.dataElements["underlyingCOD_code"]];
  if (underlyingCode && underlyingCode !== "") {
    return {
      required: false,
      reason: "doris_success",
      message: "DORIS processing already completed."
    };
  }
  
  // Check if manual processing is already selected
  const processedBy = currentEvent?.dataValues[formMapping.dataElements["underlyingCOD_processed_by"]];
  if (processedBy === "Manual") {
    return {
      required: false,
      reason: "manual_selected",
      message: "Manual processing already selected."
    };
  }
  
  // DORIS processing is required
  return {
    required: true,
    reason: "doris_required",
    message: "Please use the DORIS tool to determine the underlying cause of death before saving/completing."
  };
};

const Form = ({ 
  changeRoute,
  mutateTei,
  mutateAttribute,
  mutateEnrollment,
  mutateEvent,
  mutateDataValue,
  data,
  metadata,
  userRoles,
}) => {
  const { t } = useTranslation();
  const { dataApi } = useApi();

  const [ sideBar, setSideBar ] = useState(true);
  const [ profileSection, setProfileSection ] = useState(true); 
  const [ resultSection, setResultSection ] = useState(true); 

  const [loading,setLoading]=useState(false);
  const [exitWarning,setExitWarning]=useState(false);
  const [deleteWarning,setDeleteWarning]=useState(false);

  const { currentTei, currentEnrollment, currentEvents } = data;
  const { programMetadata, formMapping } = metadata;

  const [openCertificate, setOpenCertificate] = useState(false);
  const [certificate, setCertificate] = useState(false);

  const [saIdError, setSaIdError] = useState(null);
  const [saIdHelper, setSaIdHelper] = useState(null);
  const [barcodeError, setBarcodeError] = useState(null);
  const [barcodeHelper, setBarcodeHelper] = useState(null);

  useEffect(() => {
    setCertificate (
      currentEvents[0] &&
      currentEvents[0].dataValues &&
      currentEvents[0].dataValues[formMapping.dataElements["underlyingCOD"]]
    );
    console.log(data)
  }, [data]);

  return (
    <div className="form-wrapper">
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <WarningDialog 
        open={exitWarning}
        handleCancel={() => {
          setExitWarning(false);
        }}
        handleOk={() => {
          mutateTei("isDirty", false);
          mutateEnrollment("isDirty", false);
          mutateEvent(currentEvents[0].event, "isDirty", false);
          changeRoute("list");
        }}
      ></WarningDialog>
      <DeleteDialog 
        open={deleteWarning}
        handleCancel={() => {
          setDeleteWarning(false);
        }}
        handleDeleteEnrollment={async () => {
          await dataApi.push(
            `/api/enrollments/${currentEnrollment.enrollment}`,
            {},
            "DELETE"
          );
          changeRoute("list");
        }}
        handleDeleteTEI={async () => {
          await dataApi.push(
            `/api/trackedEntityInstances/${currentEnrollment.trackedEntityInstance}`,
            {},
            "DELETE"
          );
          changeRoute("list");
        }}
      ></DeleteDialog>
      <div className="form-container">
        <DeathCertificate
          open={openCertificate}
          onCancel={() => {
            setOpenCertificate(false);
          }}
          onLoading={() => {
            setLoading(false);
          }}
        />
        <div className={sideBar ? "profile-section-container" : "profile-section-container-hidden"}>
          <div className="section-title-profile-container">
            <div className="section-title-profile">
              <FontAwesomeIcon icon={faUserEdit} style={{ fontSize: 15 }} />
              &nbsp; 
              {t("profile")}
            </div>
            <ButtonGroup
              style={{
                float: "right",
              }}
            >
              <Button 
                type="text" 
                style={{ 
                  color: "#ffffff", 
                  width: "300px",
                  fontSize: "15px", 
                  fontWeight: "bold",
                  lineHeight: "5px",
                  textAlign: "right",
                  padding: "0px 5px"
                }}
                icon={<FontAwesomeIcon icon={profileSection ? faAngleDoubleUp : faAngleDoubleDown} style={{ fontSize: 15 }} />}
                onClick={() => {setProfileSection(!profileSection)}}
              />
            </ButtonGroup>
          </div>
          <div className={profileSection ? "profile-section" : "profile-section-hidden"}>
            <div className="profile-content">
              <Profile
                saIdError={saIdError}
                setSaIdError={setSaIdError}
                saIdHelper={saIdHelper}
                setSaIdHelper={setSaIdHelper}
                barcodeError={barcodeError}
                setBarcodeError={setBarcodeError}
                barcodeHelper={barcodeHelper}
                setBarcodeHelper={setBarcodeHelper}
                mutateAttribute={mutateAttribute}
                mutateEnrollment={mutateEnrollment}
                mutateEvent={mutateEvent}
                metadata={metadata}
                data={data}
              />
            </div>
            <div className="profile-button">
              <ButtonGroup
                style={{
                  float: "right",
                  padding: "1.5px",
                }}
              >
                {currentTei.isNew ? <Button
                  type="primary" 
                  style={{
                    width: "110px",
                    marginLeft: "3px"
                  }}

                  onClick={async () => {
                    // First check type_of_fileno dependent fields
                    if (currentTei.attributes[formMapping.attributes["type_of_fileno"]]) {
                      if (currentTei.attributes[formMapping.attributes["type_of_fileno"]] === "TYPE_HPRN" ||
                          currentTei.attributes[formMapping.attributes["type_of_fileno"]] === "TYPE_BOTH") {
                        if (!currentTei.attributes[formMapping.attributes["HPRN_no"]]) {
                          message.error("HPRN number is required!");
                          return;
                        }
                      }
                      
                      if (currentTei.attributes[formMapping.attributes["type_of_fileno"]] === "TYPE_PAT_FILE" ||
                          currentTei.attributes[formMapping.attributes["type_of_fileno"]] === "TYPE_BOTH") {
                        if (!currentTei.attributes[formMapping.attributes["patient_file_no"]]) {
                          message.error("Patient file number is required!");
                          return;
                        }
                      }
                    }

                    // Then check identification_type dependent fields
                    if (currentTei.attributes[formMapping.attributes["identification_type"]]) {
                      if (currentTei.attributes[formMapping.attributes["identification_type"]] === "ID_TYPE_SA") {
                        const saIdNumber = currentTei.attributes[formMapping.attributes["sa_id_number"]];
                        
                        // Check if SA ID number is provided
                        if (!saIdNumber || saIdNumber.trim() === '') {
                          message.error("SA ID number is required!");
                          return;
                        }
                        
                        // Check if SA ID number is exactly 13 digits
                        if (saIdNumber.length !== 13) {
                          message.error("SA ID number must be exactly 13 digits!");
                          return;
                        }
                        
                        // Check if SA ID number contains only digits
                        if (!/^\d+$/.test(saIdNumber)) {
                          message.error("SA ID number must contain only digits!");
                          return;
                        }
                        
                        // Validate SA ID number format and checksum
                        const validation = validateSAIdNumber(saIdNumber);
                        if (!validation.isValid) {
                          message.error(validation.error);
                          return;
                        }
                        
                        // Check for duplicate SA ID number
                        if (saIdError === "This ID number already exists in the system.") {
                          message.error(saIdError);
                          return;
                        }
                      }
                      
                      if (currentTei.attributes[formMapping.attributes["identification_type"]] === "ID_TYPE_PASSPORT") {
                        if (!currentTei.attributes[formMapping.attributes["passport_number"]]) {
                          message.error("Passport number is required!");
                          return;
                        }
                      }

                      // Check for barcode duplicates when DHA is selected
                      if (currentTei.attributes[formMapping.attributes["type_of_death_reg_no"]] === "DHA") {
                        if (!currentTei.attributes[formMapping.attributes["barcode_number"]]) {
                          message.error("Barcode number is required for DHA!");
                          return;
                        }
                        if (barcodeError) {
                          message.error(barcodeError);
                          return;
                        }
                      }
                    }

                    // Then proceed with existing compulsory field checks
                    if ( 
                      programMetadata.trackedEntityAttributes
                        .filter( ({compulsory}) => compulsory )
                        .filter( ({id}) => {
                          // Exclude barcode field if DOA is selected (since it's hidden)
                          if (id === formMapping.attributes["barcode_number"] && 
                              currentTei.attributes[formMapping.attributes["type_of_death_reg_no"]] === "DOA") {
                            return false;
                          }
                          return true;
                        })
                        .every( ({id}) => currentTei.attributes[id] && currentTei.attributes[id] !== "" )
                      && currentEnrollment['enrollmentDate'] && currentEnrollment.enrollmentDate !== ""
                      && currentEnrollment['incidentDate'] && currentEnrollment['incidentDate'] !== ""
                    ) {
                      setLoading(true);
                      const { currentTei, currentEnrollment, currentEvents } = generateDhis2Payload(
                        data,
                        programMetadata
                      );
                      await dataApi.pushTrackedEntityInstance(
                        currentTei,
                        programMetadata.id
                      );
                      await dataApi.pushEnrollment(
                        currentEnrollment,
                        programMetadata.id
                      );
                      await dataApi.pushTrackedEntityInstance(
                        currentTei,
                        programMetadata.id
                      );
                      mutateTei("isSaved", true);
                      mutateTei("isNew", false);

                      // Dirty Check
                      mutateTei("isDirty", false);
                      mutateEnrollment("isDirty", false);

                      // Notification
                      setLoading(false);
                      message.success("Profile is saved successfully!")
                    }
                    else {
                      // Debug: Log which fields are missing
                      console.log("=== MISSING COMPULSORY FIELDS DEBUG ===");
                      
                      // Check tracked entity attributes
                      const missingAttributes = programMetadata.trackedEntityAttributes
                        .filter(({compulsory}) => compulsory)
                        .filter(({id}) => !currentTei.attributes[id] || currentTei.attributes[id] === "");
                      
                      if (missingAttributes.length > 0) {
                        console.log("Missing compulsory attributes:", missingAttributes.map(attr => ({
                          id: attr.id,
                          name: attr.name,
                          value: currentTei.attributes[attr.id]
                        })));
                      }
                      
                      // Check enrollment date
                      if (!currentEnrollment['enrollmentDate'] || currentEnrollment.enrollmentDate === "") {
                        console.log("Missing enrollmentDate:", currentEnrollment['enrollmentDate']);
                      }
                      
                      // Check incident date
                      if (!currentEnrollment['incidentDate'] || currentEnrollment['incidentDate'] === "") {
                        console.log("Missing incidentDate:", currentEnrollment['incidentDate']);
                      }
                      
                      console.log("Current TEI attributes:", currentTei.attributes);
                      console.log("Current enrollment:", currentEnrollment);
                      console.log("=== END DEBUG ===");
                      
                      message.error("All compulsory fields must be filled!")
                    }
                  }}
                >
                  Create
                </Button> : userRoles.admin ? <Button
                  type="primary" 
                  danger
                  style={{
                    width: "110px"
                  }}
                  disabled={currentTei.isNew && !currentTei.isSaved}
                  onClick={() => {
                    setDeleteWarning(true);
                  }}
                >
                  Delete
                </Button> : <></>}
              </ButtonGroup>
            </div>
          </div>

          <div className="section-title-result-container">
            <div className="section-title-result">
              <FontAwesomeIcon icon={faNotesMedical} style={{ fontSize: 15 }} />
              &nbsp; Output
            </div>
            <ButtonGroup
              style={{
                float: "right",
              }}
            >
              <Button 
                type="text" 
                style={{ 
                  color: "#ffffff", 
                  width: "300px",
                  fontSize: "15px", 
                  fontWeight: "bold",
                  lineHeight: "5px",
                  textAlign: "right",
                  padding: "0px 5px"
                }}
                icon={<FontAwesomeIcon icon={resultSection ? faAngleDoubleUp : faAngleDoubleDown} style={{ fontSize: 15 }} />}
                onClick={() => {setResultSection(!resultSection)}}
              />
            </ButtonGroup>
          </div>
          <div className={ resultSection ? "result-section" : "result-section-hidden"}>
            <div className="result-content">
              <Result />
            </div>
            {/* <div className="result-button">
              <ButtonGroup
                style={{
                  float: "right",
                  padding: "1.5px",
                }}
              >
                <Button
                  type="primary" 
                  style={{
                    width: "110px",
                  }}
                  disabled={!certificate}
                  onClick={() => { setOpenCertificate(true); }}
                >
                  Certificate
                </Button>
              </ButtonGroup>
            </div> */}
          </div>
        </div>
        <div className={sideBar ? "stage-section-container" : "stage-section-container-fullscreen"}>
          <div className="stage-button">
            <ButtonGroup
              style={{
                // float: "right",
                padding: "1.5px",
              }}
            >
              <Button
                style={{
                  width: "110px"
                }}
                disabled={currentTei.isNew}
                icon={sideBar ? <DoubleLeftOutlined /> : <DoubleRightOutlined />}
                onClick={() => {setSideBar(!sideBar)}}
              >
                {sideBar ? "Collapse" : "Expand"}
              </Button>
              <Button
                type="primary" 
                style={{
                  width: "110px",
                  marginLeft: "3px",
                }}
                disabled={!certificate}
                onClick={() => { 
                  setOpenCertificate(true);
                  setLoading(true);
                }}
              >
                Certificate
              </Button>
            </ButtonGroup>
            <ButtonGroup
                style={{
                  float: "right",
                  padding: "1.5px",
                }}
              >
              <Button
                style={{
                  width: "110px"
                }}
                onClick={async () => {
                  setLoading(true);
                  const { currentEvents } = generateDhis2Payload(data, programMetadata);
                  mutateEvent(currentEvents[0].event,"dataValues",{});
                  setLoading(false);
                }}
                disabled={currentTei.isNew}
              >
                Clear
              </Button>
              {
                  currentEnrollment.status === "COMPLETED" ? <Button
                    style={{
                      width: "110px",
                      marginLeft: "3px",
                      backgroundColor: "#f0ad4e",
                      color: "white"
                    }}
                    onClick={async () => {
                      setLoading(true);

                      mutateEnrollment("status", "ACTIVE");
                      mutateAttribute(formMapping.attributes["status"], "Pending");

                      const { currentTei, currentEnrollment } = generateDhis2Payload(
                        data,
                        programMetadata
                      );
                      await dataApi.pushEnrollment(
                        currentEnrollment,
                        programMetadata.id
                      );
                      await dataApi.pushTrackedEntityInstance(
                        currentTei,
                        programMetadata.id
                      );
                      mutateTei("isSaved", true);

                      // Dirty Check
                      mutateTei("isDirty", false);
                      mutateEnrollment("isDirty", false);
                      
                      setLoading(false);
                    }}
                  >
                    Reopen
                  </Button>
                  :
                  <Button
                    style={currentTei.isNew ? {
                      width: "110px",
                      marginLeft: "3px"
                    } : {
                      width: "110px",
                      marginLeft: "3px",
                      backgroundColor: "#f0ad4e",
                      color: "white"
                    }}
                    disabled={currentTei.isNew}
                    onClick={async () => {
                      // Validate SA ID number before completing
                      if (!validateSAIdBeforeSave(currentTei, formMapping)) {
                        return;
                      }
                      
                      // Check DORIS requirement
                      const dorisCheck = checkDorisRequirement(data, metadata);
                      if (dorisCheck.required) {
                        message.warning(dorisCheck.message);
                        return;
                      }
                      
                      // Proceed with completion
                      setLoading(true);

                      mutateEnrollment("status", "COMPLETED");
                      mutateAttribute(formMapping.attributes["status"], "Completed");

                      const { currentTei: payloadTei, currentEnrollment: payloadEnrollment, currentEvents: payloadEvents } = generateDhis2Payload(
                        data,
                        programMetadata
                      );
                      await dataApi.pushEnrollment(
                        payloadEnrollment,
                        programMetadata.id
                      );
                      await dataApi.pushTrackedEntityInstance(
                        payloadTei,
                        programMetadata.id
                      );
                      await dataApi.pushEvents({ events: payloadEvents });
                      mutateTei("isSaved", true);

                      // Dirty Check
                      mutateTei("isDirty", false);
                      mutateEnrollment("isDirty", false);
                      mutateEvent(payloadEvents[0].event,"isDirty",false);
                      
                      setLoading(false);
                    }}
                  >
                    Complete
                  </Button>
                }
                <Button
                  type="primary" 
                  style={{
                    width: "110px",
                    marginLeft: "3px"
                  }}
                  disabled={currentTei.isNew}
                  onClick={async () => {
                    // Validate SA ID number before saving
                    if (!validateSAIdBeforeSave(currentTei, formMapping)) {
                      return;
                    }
                    
                    // Check DORIS requirement
                    const dorisCheck = checkDorisRequirement(data, metadata);
                    if (dorisCheck.required) {
                      message.warning(dorisCheck.message);
                      return;
                    }
                    
                    // Proceed with saving
                    setLoading(true);
                    const { currentTei: payloadTei, currentEnrollment: payloadEnrollment, currentEvents: payloadEvents } = generateDhis2Payload(
                      data,
                      programMetadata
                    );
                    await dataApi.pushTrackedEntityInstance(
                      payloadTei,
                      programMetadata.id
                    );
                    await dataApi.pushEnrollment(
                      payloadEnrollment,
                      programMetadata.id
                    );
                    await dataApi.pushTrackedEntityInstance(
                      payloadTei,
                      programMetadata.id
                    );
                    await dataApi.pushEvents({ events: payloadEvents });
                    mutateTei("isSaved", true);
          
                    // Dirty Check
                    mutateTei("isDirty", false);
                    mutateEnrollment("isDirty", false);
                    mutateEvent(payloadEvents[0].event,"isDirty",false);
          
                    // Notification
                    setLoading(false);
                    message.success("Saved Successfully!");
                  }}
                >
                  Save
                </Button>
                <Button
                  type="danger"
                  style={{
                    width: "110px",
                    marginLeft: "3px"
                  }}
                  onClick={() => {
                    if ( currentTei.isDirty || currentEnrollment.isDirty || currentEvents[0].isDirty ) {
                      setExitWarning(true);
                    }
                    else {
                      changeRoute("list");
                    }
                  }}
                >
                  Close
                </Button>
              </ButtonGroup>
          </div>
          <div className="stage-sections-container">
            <div className="stage-section">
              { !currentTei.isNew ? <Stage /> : currentTei.isSaved ? <Stage />: <></> }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const mapStateToProps = (state) => {
  return {
    metadata: state.metadata,
    data: state.data,
    userRoles: state.user.userRoles,
  };
};

const mapDispatchToProps = {
  changeRoute,
  mutateTei,
  mutateAttribute,
  mutateEnrollment,
  mutateEvent,
  mutateDataValue,
};

export default connect(mapStateToProps, mapDispatchToProps)(Form);
