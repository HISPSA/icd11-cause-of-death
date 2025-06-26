import { useEffect, useState } from "react";
import InputField from "../InputField";
import { Col, Row, message } from "antd";
import moment from "moment";
/* REDUX */
import { connect } from "react-redux";
import {
  mutateTei,
  mutateAttribute,
  mutateEnrollment,
  mutateEvent,
} from "../../redux/actions/data";

import { useTranslation } from "react-i18next";

/*       */
import { Hooks } from "tracker-capture-app-core";
import { validateSAIdNumber, extractDateOfBirth, sanitizeSAIdInput } from "../../utils/saIdValidation";

const { useApi } = Hooks;
const Profile = ({
  mutateAttribute,
  mutateEnrollment,
  mutateEvent,
  metadata,
  data,
  saIdError,
  setSaIdError,
  saIdHelper,
  setSaIdHelper,
}) => {
  const { t } = useTranslation();
  const { metadataApi, dataApi } = useApi();
  
  const {
    currentTei,
    currentEnrollment,
    currentEvents,
    currentEnrollment: { status: enrollmentStatus },
  } = data;
  const { programMetadata, formMapping, fullnameOption, selectedOrgUnit } = metadata;

  // Real-time SA ID validation function
  const validateSAIdRealTime = async (idNumber) => {
    const idType = currentTei.attributes[formMapping.attributes["identification_type"]];
    
    // Only validate if ID type is SA
    if (idType !== "ID_TYPE_SA") {
      setSaIdError(null);
      setSaIdHelper(null);
      return;
    }
    
    // Clear error if no input
    if (!idNumber || idNumber.trim() === '') {
      setSaIdError(null);
      setSaIdHelper(null);
      return;
    }
    
    // Show helper text while typing
    if (idNumber.length > 0 && idNumber.length < 13) {
      setSaIdHelper(`Please enter all 13 digits (${idNumber.length}/13)`);
      setSaIdError(null);
    } else if (idNumber.length === 13) {
      setSaIdHelper(null);
      const validation = validateSAIdNumber(idNumber);
      if (!validation.isValid) {
        setSaIdError(validation.error);
      } else {
        // Only check for duplicates when creating a new record
        if (currentTei.isNew) {
          // Check for duplicate using dataApi for proper authentication
          setSaIdHelper("Checking for duplicates...");
          setSaIdError(null);
          try {
            const response = await dataApi.pull(`/api/41/tracker/trackedEntities?program=ogrOUKoSaWA&orgUnitMode=ACCESSIBLE&filter=iS1g0uT0Dsb:EQ:${idNumber}`);
            const isDuplicate = response.trackedEntities && response.trackedEntities.length > 0;
            if (isDuplicate) {
              setSaIdError("This ID number already exists in the system.");
              setSaIdHelper(null);
            } else {
              setSaIdError(null);
              setSaIdHelper("✓ Valid SA ID number");
            }
          } catch (error) {
            console.error("Error checking for duplicates:", error);
            // On error, assume not duplicate (fail open)
            setSaIdError(null);
            setSaIdHelper("✓ Valid SA ID number");
          }
        } else {
          // For existing records, just show valid without duplicate check
          setSaIdError(null);
          setSaIdHelper("✓ Valid SA ID number");
        }
      }
    } else {
      setSaIdError(null);
      setSaIdHelper(null);
    }
  };

  // Add calculateAge function
  const calculateAge = (dobValue) => {
    if (!dobValue) return;

    try {
      const age_cal = parseInt(
        moment(currentEnrollment.incidentDate || moment(), "YYYY-MM-DD").diff(
          moment(dobValue, "YYYY-MM-DD"),
          "years",
          true
        )
      );

      if (age_cal > 150) {
        message.error("Age can't be greater than 150");
        return;
      }
      if (age_cal < 0) {
        message.error("Age can't be negative number");
        return;
      }
      if (!isNaN(age_cal)) {
        mutateAttribute(formMapping.attributes["age"], age_cal + "");
        if (age_cal === 0) {
          const age_cal_in_months = parseInt(
            moment(currentEnrollment.incidentDate || moment(), "YYYY-MM-DD").diff(
              moment(dobValue, "YYYY-MM-DD"),
              "months",
              true
            )
          );
          if (age_cal_in_months === 0) {
            const age_cal_in_days = parseInt(
              moment(currentEnrollment.incidentDate || moment(), "YYYY-MM-DD").diff(
                moment(dobValue, "YYYY-MM-DD"),
                "days",
                true
              )
            );
            mutateAttribute(formMapping.attributes["estimated_age"], age_cal_in_days + "");
            mutateAttribute(formMapping.attributes["age_unit"], "P_D");
          } else {
            mutateAttribute(formMapping.attributes["estimated_age"], age_cal_in_months + "");
            mutateAttribute(formMapping.attributes["age_unit"], "P_M");
          }
        } else {
          mutateAttribute(formMapping.attributes["estimated_age"], age_cal + "");
          mutateAttribute(formMapping.attributes["age_unit"], "P_YD");
        }
      }
    } catch (error) {
      console.error("Error calculating age:", error);
    }
  };

  useEffect(() => {
    if (getTeaValue(formMapping.attributes["system_id"]) === "") {
      metadataApi
        .get(
          `/api/trackedEntityAttributes/${formMapping.attributes["system_id"]}/generate.json`
        )
        .then((res) => {
          mutateAttribute(formMapping.attributes["system_id"], res.value);
        });
    }
  }, [data]);

  useEffect(() => {
    if (
      currentEnrollment["enrollmentDate"] &&
      currentEnrollment["incidentDate"]
    ) {
      if (
        currentEnrollment["enrollmentDate"] < currentEnrollment["incidentDate"]
      ) {
        message.error(
          "ERROR!!! Reported Date must be greater than incidentDate"
        );
      }
    }
  }, [currentEnrollment["enrollmentDate"], currentEnrollment["incidentDate"]]);

  // Update SA ID processing useEffect
  useEffect(() => {
    const saIdNumber = currentTei.attributes[formMapping.attributes["sa_id_number"]];
    const idType = currentTei.attributes[formMapping.attributes["identification_type"]];

    // Clear error when ID type changes
    if (idType !== "ID_TYPE_SA") {
      setSaIdError(null);
      setSaIdHelper(null);
    }

    if (idType === "ID_TYPE_SA" && saIdNumber) {
      // Trigger real-time validation
      validateSAIdRealTime(saIdNumber);
      
      // Only process if we have a complete 13-digit ID number
      if (saIdNumber.length === 13) {
        const validation = validateSAIdNumber(saIdNumber);
        
        if (validation.isValid) {
          // Extract and set date of birth
          const dobData = extractDateOfBirth(saIdNumber);
          if (dobData) {
            mutateAttribute(formMapping.attributes["dob"], dobData.formatted);
            calculateAge(dobData.formatted);
          }
        } else {
          // Show validation error but don't prevent form submission
          console.warn("SA ID validation warning:", validation.error);
        }
      }
    }
  }, [currentTei.attributes[formMapping.attributes["sa_id_number"]], currentTei.attributes[formMapping.attributes["identification_type"]]]);

  // Add useEffect for auto-populating health facility name
  useEffect(() => {
    if (selectedOrgUnit && selectedOrgUnit.displayName) {
      mutateAttribute(formMapping.attributes["name_of_health_facility_practice"], selectedOrgUnit.displayName);
    }
  }, [selectedOrgUnit]);

  const getTeaMetadata = (attribute) =>
    programMetadata.trackedEntityAttributes.find((tea) => tea.id === attribute);

  const getTeaValue = (attribute) =>
    currentTei.attributes[attribute] ? currentTei.attributes[attribute] : "";

  const populateInputField = (attribute, forceCompulsory, dateRestriction) => {
    const tea = getTeaMetadata(attribute);
    const value = getTeaValue(attribute);
    if (tea) {
      const isDateField = tea.valueType === "DATE" || 
                         tea.valueType === "DATE_WITH_RANGE" || 
                         attribute === formMapping.attributes["notification_date"];

      return (
        <InputField
          value={value}
          valueType={isDateField ? "DATE_WITH_RANGE" : tea.valueType}
          label={tea.displayFormName}
          valueSet={tea.valueSet}
          error={attribute === formMapping.attributes["sa_id_number"] ? saIdError : undefined}
          helper={attribute === formMapping.attributes["sa_id_number"] ? saIdHelper : undefined}
          helperSuccess={attribute === formMapping.attributes["sa_id_number"] && saIdHelper === "✓ Valid SA ID number"}
          change={async (newValue) => {
            if (attribute === formMapping.attributes["sa_id_number"]) {
              const sanitizedValue = sanitizeSAIdInput(newValue);
              mutateAttribute(tea.id, sanitizedValue);
              // Trigger real-time validation (async)
              await validateSAIdRealTime(sanitizedValue);
            } else {
              mutateAttribute(tea.id, newValue);

              // Calculate age when date of birth is entered
              if (attribute === formMapping.attributes["dob"] && newValue) {
                calculateAge(newValue);
              }
            }
          }}
          disabled={
            attribute === formMapping.attributes["system_id"] ||
            attribute === formMapping.attributes["name_of_health_facility_practice"] ||
            enrollmentStatus === "COMPLETED"
          }
          mandatory={
            forceCompulsory !== undefined ? forceCompulsory : tea.compulsory
          }
          disabledDate={
            isDateField && dateRestriction
              ? dateRestriction === "DISABLE_FUTURE_DATE"
                ? (current) => current && current > moment().endOf("day")
                : dateRestriction === "DISABLE_PAST_DATE"
                ? (current) => current && current < moment().startOf("day")
                : undefined
              : undefined
          }
        />
      );
    }
  };

  /*
  const hasUnderlying = () => {
    const currentEvent = data.currentEvents.find((event) => {
      return event.programStage === formMapping.programStage;
    });
    return (
      currentEvent &&
      currentEvent.dataValues &&
      currentEvent.dataValues[formMapping.dataElements["underlyingCOD"]]
    );
  };
  */

  const renderDOBGroup = () => {
    const dob = getTeaMetadata(formMapping.attributes["dob"]);
    const age = getTeaMetadata(formMapping.attributes["age"]);
    const isEstimated = getTeaMetadata(formMapping.attributes["estimated_dob"]);
    const estimatedAge = getTeaMetadata(formMapping.attributes["estimated_age"]);
    const ageUnit = getTeaMetadata(formMapping.attributes["age_unit"]);
    
    // Check if SA ID is valid and should disable age fields
    const isSAId = 
      currentTei.attributes[formMapping.attributes["identification_type"]] === "ID_TYPE_SA" &&
      currentTei.attributes[formMapping.attributes["sa_id_number"]] &&
      currentTei.attributes[formMapping.attributes["sa_id_number"]].length === 13 &&
      validateSAIdNumber(currentTei.attributes[formMapping.attributes["sa_id_number"]]).isValid;
    
    return (
      <>
        <Row justify="start" align="middle">
          <Col>
            <InputField
              value={getTeaValue(formMapping.attributes["estimated_dob"])}
              valueType={isEstimated.valueType}
              valueSet={isEstimated.valueSet}
              change={(value) => {
                mutateAttribute(isEstimated.id, value);
              }}
              disabled={enrollmentStatus === "COMPLETED" || isSAId}
            />
          </Col>
          <Col>
            <div className="input-label">{`${isEstimated.displayFormName}${
              isEstimated.compulsory ? " *" : ""
            }`}</div>
          </Col>
        </Row>
        <Row>
          <Col span={24}>
            <InputField
              value={getTeaValue(formMapping.attributes["dob"])}
              valueType={"DATE_WITH_RANGE"}
              label={dob.displayFormName}
              valueSet={dob.valueSet}
              change={(value) => {
                mutateAttribute(dob.id, value);
                if (value) {
                  calculateAge(value);
                }
              }}
              disabledDate={(current) =>
                current && current >= moment().startOf("day")
              }
              disabled={
                enrollmentStatus === "COMPLETED" ||
                getTeaValue(formMapping.attributes["estimated_dob"]) === true ||
                getTeaValue(formMapping.attributes["estimated_dob"]) === "true" ||
                isSAId
              }
              mandatory={dob.compulsory}
            />
          </Col>
        </Row>
        <Row>
          <Col xs={24} sm={12}>
            <InputField
              label={ageUnit.displayFormName}
              valueType={ageUnit.valueType}
              valueSet={ageUnit.valueSet}
              value={getTeaValue(formMapping.attributes["age_unit"])}
              disabled={
                enrollmentStatus === "COMPLETED" ||
                getTeaValue(formMapping.attributes["estimated_dob"]) === true ||
                getTeaValue(formMapping.attributes["estimated_dob"]) === "true" ||
                isSAId
              }
              mandatory={ageUnit.compulsory}
              change={(value) => {
                mutateAttribute(ageUnit.id, value);
                if (getTeaValue(estimatedAge.id) !== "") {
                  if (value === "P_YD") {
                    mutateAttribute(age.id, getTeaValue(estimatedAge.id));
                    if (currentEnrollment.incidentDate) {
                      mutateAttribute(
                        dob.id,
                        moment(currentEnrollment.incidentDate, "YYYY-MM-DD")
                          .subtract(
                            parseInt(getTeaValue(estimatedAge.id)),
                            "years"
                          )
                          .format("YYYY-MM-DD")
                      );
                    }
                  } else if (value === "P_M") {
                    mutateAttribute(age.id, 0);
                    if (currentEnrollment.incidentDate) {
                      mutateAttribute(
                        dob.id,
                        moment(currentEnrollment.incidentDate, "YYYY-MM-DD")
                          .subtract(
                            parseInt(getTeaValue(estimatedAge.id)),
                            "months"
                          )
                          .format("YYYY-MM-DD")
                      );
                    }
                  } else if (value === "P_D") {
                    mutateAttribute(age.id, 0);
                    if (currentEnrollment.incidentDate) {
                      mutateAttribute(
                        dob.id,
                        moment(currentEnrollment.incidentDate, "YYYY-MM-DD")
                          .subtract(
                            parseInt(getTeaValue(estimatedAge.id)),
                            "days"
                          )
                          .format("YYYY-MM-DD")
                      );
                    }
                  } else {
                    mutateAttribute(age.id, 0);
                    if (currentEnrollment.incidentDate) {
                      mutateAttribute(dob.id, currentEnrollment.incidentDate);
                    }
                  }
                }
              }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <InputField
              label={estimatedAge.displayFormName}
              valueType={estimatedAge.valueType}
              value={getTeaValue(formMapping.attributes["estimated_age"])}
              disabled={
                enrollmentStatus === "COMPLETED" ||
                getTeaValue(formMapping.attributes["estimated_dob"]) === true ||
                getTeaValue(formMapping.attributes["estimated_dob"]) === "true" ||
                isSAId
              }
              mandatory={estimatedAge.compulsory}
              change={(value) => {
                if (value > 0) {
                  mutateAttribute(estimatedAge.id, value);
                  if (getTeaValue(ageUnit.id) === "P_YD") {
                    mutateAttribute(age.id, value);
                    if (currentEnrollment.incidentDate) {
                      mutateAttribute(
                        dob.id,
                        moment(currentEnrollment.incidentDate, "YYYY-MM-DD")
                          .subtract(parseInt(value), "years")
                          .format("YYYY-MM-DD")
                      );
                    }
                  } else if (getTeaValue(ageUnit.id) === "P_M") {
                    mutateAttribute(age.id, 0);
                    if (currentEnrollment.incidentDate) {
                      mutateAttribute(
                        dob.id,
                        moment(currentEnrollment.incidentDate, "YYYY-MM-DD")
                          .subtract(parseInt(value), "months")
                          .format("YYYY-MM-DD")
                      );
                    }
                  } else if (getTeaValue(ageUnit.id) === "P_D") {
                    mutateAttribute(age.id, 0);
                    if (currentEnrollment.incidentDate) {
                      mutateAttribute(
                        dob.id,
                        moment(currentEnrollment.incidentDate, "YYYY-MM-DD")
                          .subtract(parseInt(value), "days")
                          .format("YYYY-MM-DD")
                      );
                    }
                  } else {
                    mutateAttribute(age.id, 0);
                    if (currentEnrollment.incidentDate) {
                      mutateAttribute(dob.id, currentEnrollment.incidentDate);
                    }
                  }
                }
              }}
            />
          </Col>
        </Row>
      </>
    );
  };

  return (
    <div>
      <InputField
        value={currentEnrollment.enrollmentDate || ""}
        label={t("reportedDate")}
        valueType={"DATE_WITH_RANGE"}
        disabledDate={(current) => current && current > moment().endOf("day")}
        change={(value) => {
          mutateEnrollment("enrollmentDate", value);
        }}
        disabled={enrollmentStatus === "COMPLETED"}
        mandatory={true}
      />

      {populateInputField(formMapping.attributes["notification_date"], undefined, "DISABLE_FUTURE_DATE")}

      {/*         
        SA Custom Changes - 01/06/2025
        Sort Order
    */}
      {populateInputField(formMapping.attributes["system_id"])}
      {populateInputField(formMapping.attributes["barcode_number"])}

        <InputField
        value={currentEnrollment.incidentDate || ""}
        label={t("incidentDate")}
        valueType={"DATE_WITH_RANGE"}
        disabledDate={(current) => current && current > moment().endOf("day")}
        change={(value) => {
          mutateEnrollment("incidentDate", value);
          currentEvents.forEach((event) => {
            mutateEvent(event.event, "eventDate", value);
            mutateEvent(event.event, "dueDate", value);
          });
          if (currentTei.attributes[formMapping.attributes["dob"]]) {
            console.log("calculate age");
            const age_cal = parseInt(
              moment(currentEnrollment.incidentDate, "YYYY-MM-DD").diff(
                moment(
                  getTeaValue(formMapping.attributes["dob"]),
                  "YYYY-MM-DD"
                ),
                "years",
                true
              )
            );
            if (age_cal > 150) message.error("Age can't be greater than 150");
            else if (age_cal < 0) message.error("Age can't be negative number");
            else if (!isNaN(age_cal)) {
              mutateAttribute(formMapping.attributes["age"], age_cal + "");
              if (age_cal === 0) {
                const age_cal_in_months = parseInt(
                  moment(currentEnrollment.incidentDate, "YYYY-MM-DD").diff(
                    moment(
                      getTeaValue(formMapping.attributes["dob"]),
                      "YYYY-MM-DD"
                    ),
                    "months",
                    true
                  )
                );
                if (age_cal_in_months === 0) {
                  const age_cal_in_days = parseInt(
                    moment(currentEnrollment.incidentDate, "YYYY-MM-DD").diff(
                      moment(
                        getTeaValue(formMapping.attributes["dob"]),
                        "YYYY-MM-DD"
                      ),
                      "days",
                      true
                    )
                  );
                  mutateAttribute(
                    formMapping.attributes["estimated_age"],
                    age_cal_in_days + ""
                  );
                  mutateAttribute(formMapping.attributes["age_unit"], "P_D");
                } else {
                  mutateAttribute(
                    formMapping.attributes["estimated_age"],
                    age_cal_in_months + ""
                  );
                  mutateAttribute(formMapping.attributes["age_unit"], "P_M");
                }
              } else {
                mutateAttribute(
                  formMapping.attributes["estimated_age"],
                  age_cal + ""
                );
                mutateAttribute(formMapping.attributes["age_unit"], "P_YD");
              }
            }
          } else if (
            currentTei.attributes[formMapping.attributes["estimated_age"]] &&
            currentTei.attributes[formMapping.attributes["age_unit"]]
          ) {
            if (getTeaValue(formMapping.attributes["age_unit"]) === "P_YD") {
              mutateAttribute(
                formMapping.attributes["age"],
                getTeaValue(formMapping.attributes["estimated_age"])
              );
              if (currentEnrollment.incidentDate) {
                mutateAttribute(
                  formMapping.attributes["dob"],
                  moment(currentEnrollment.incidentDate, "YYYY-MM-DD")
                    .subtract(
                      parseInt(
                        getTeaValue(formMapping.attributes["estimated_age"])
                      ),
                      "years"
                    )
                    .format("YYYY-MM-DD")
                );
              }
            } else if (
              getTeaValue(formMapping.attributes["age_unit"]) === "P_M"
            ) {
              mutateAttribute(formMapping.attributes["age"], 0);
              if (currentEnrollment.incidentDate) {
                mutateAttribute(
                  formMapping.attributes["dob"],
                  moment(currentEnrollment.incidentDate, "YYYY-MM-DD")
                    .subtract(
                      parseInt(
                        getTeaValue(formMapping.attributes["estimated_age"])
                      ),
                      "months"
                    )
                    .format("YYYY-MM-DD")
                );
              }
            } else if (
              getTeaValue(formMapping.attributes["age_unit"]) === "P_D"
            ) {
              mutateAttribute(formMapping.attributes["age"], 0);
              if (currentEnrollment.incidentDate) {
                mutateAttribute(
                  formMapping.attributes["dob"],
                  moment(currentEnrollment.incidentDate, "YYYY-MM-DD")
                    .subtract(
                      parseInt(
                        getTeaValue(formMapping.attributes["estimated_age"])
                      ),
                      "days"
                    )
                    .format("YYYY-MM-DD")
                );
              }
            } else {
              mutateAttribute(formMapping.attributes["age"], 0);
              if (currentEnrollment.incidentDate) {
                mutateAttribute(
                  formMapping.attributes["dob"],
                  currentEnrollment.incidentDate
                );
              }
            }
          }
        }}
        disabled={enrollmentStatus === "COMPLETED"}
        mandatory={true}
      />

       {populateInputField(formMapping.attributes["identification_type"])}

      {/* Conditional rendering of ID fields based on identification type */}
      {currentTei.attributes[formMapping.attributes["identification_type"]] ===
        "ID_TYPE_SA" &&
        populateInputField(formMapping.attributes["sa_id_number"], true)}
      {currentTei.attributes[formMapping.attributes["identification_type"]] ===
        "ID_TYPE_PASSPORT" &&
        populateInputField(formMapping.attributes["passport_number"], true)}

    

      {/* {attributes
        .slice(0, 3)
        .map((attribute) => populateInputField(attribute))} */}

     

      {renderDOBGroup()}
      {populateInputField(formMapping.attributes["sex"])}
      {fullnameOption !== "noname" &&
        fullnameOption !== "fullname" &&
        populateInputField(formMapping.attributes["family_name"])}
      {fullnameOption === "firstmidlastname" &&
        populateInputField(formMapping.attributes["middle_name"])}
      {fullnameOption !== "noname" &&
        populateInputField(formMapping.attributes["given_name"])}
      {populateInputField(formMapping.attributes["population_group"])}

      {currentTei.attributes[formMapping.attributes["population_group"]] ===
        "POP_GROUP_OTHER" &&
        populateInputField(
          formMapping.attributes["population_group_other_specify"]
        )}

      {populateInputField(formMapping.attributes["address"])}


      {populateInputField(formMapping.attributes["type_of_fileno"])}

      {/* Conditional rendering of file number fields based on type_of_fileno */}
      {(currentTei.attributes[formMapping.attributes["type_of_fileno"]] ===
        "TYPE_HPRN" ||
        currentTei.attributes[formMapping.attributes["type_of_fileno"]] ===
          "TYPE_BOTH") &&
        populateInputField(formMapping.attributes["HPRN_no"], true)}
      {(currentTei.attributes[formMapping.attributes["type_of_fileno"]] ===
        "TYPE_PAT_FILE" ||
        currentTei.attributes[formMapping.attributes["type_of_fileno"]] ===
          "TYPE_BOTH") &&
        populateInputField(formMapping.attributes["patient_file_no"], true)}

      {populateInputField(formMapping.attributes["place_of_death"])}

      {currentTei.attributes[formMapping.attributes["place_of_death"]] ===
        "PLACE_DEATH_OTHER_PLACE" &&
        populateInputField(
          formMapping.attributes["place_of_death_other_specify"]
        )}

      {populateInputField(
        formMapping.attributes["name_of_health_facility_practice"]
      )}
      {populateInputField(formMapping.attributes["facility_contact_telephone"])}

      {populateInputField(
        formMapping.attributes["facility_contact_person_surname"]
      )}
      {populateInputField(
        formMapping.attributes["facility_contact_person_forenames"]
      )}
      {populateInputField(
        formMapping.attributes["facility_contact_person_role_rank"]
      )}


      {/* For other attributes */}
      {programMetadata.trackedEntityAttributes
        .filter(
          ({ id }) =>
            !Object.values(formMapping.attributes).find((tea) => tea === id)
        )
        .map((tea) => populateInputField(tea.id))}
    </div>
  );
};

const mapStateToProps = (state) => {
  return {
    metadata: state.metadata,
    data: state.data,
  };
};
const mapDispatchToProps = {
  mutateTei,
  mutateAttribute,
  mutateEnrollment,
  mutateEvent,
};

export default connect(mapStateToProps, mapDispatchToProps)(Profile);
