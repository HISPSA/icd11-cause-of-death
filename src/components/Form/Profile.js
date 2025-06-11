import { useEffect } from "react";
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

const { useApi } = Hooks;
const Profile = ({
  mutateAttribute,
  mutateEnrollment,
  mutateEvent,
  metadata,
  data,
}) => {
  const { t } = useTranslation();
  const { metadataApi } = useApi();
  const {
    currentTei,
    currentEnrollment,
    currentEvents,
    currentEnrollment: { status: enrollmentStatus },
  } = data;
  const { programMetadata, formMapping, fullnameOption } = metadata;

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

  // Add useEffect for SA ID processing
  useEffect(() => {
    const saIdNumber =
      currentTei.attributes[formMapping.attributes["sa_id_number"]];
    const idType =
      currentTei.attributes[formMapping.attributes["identification_type"]];

    // Only process if we have a complete 13-digit ID number and correct ID type
    if (
      idType === "ID_TYPE_SA" &&
      saIdNumber &&
      saIdNumber.length === 13 &&
      /^\d+$/.test(saIdNumber)
    ) {
      try {
        const year = parseInt(saIdNumber.substring(0, 2));
        const month = saIdNumber.substring(2, 4);
        const day = saIdNumber.substring(4, 6);

        // Determine full year (assuming 1900s for now)
        const fullYear = year < 50 ? 2000 + year : 1900 + year;

        // Create date string in YYYY-MM-DD format
        const dob = `${fullYear}-${month}-${day}`;

        // Validate if it's a valid date
        if (moment(dob, "YYYY-MM-DD", true).isValid()) {
          // Update the DOB field
          mutateAttribute(formMapping.attributes["dob"], dob);

          // Calculate and update age
          const age = moment().diff(moment(dob), "years");
          if (age >= 0 && age <= 150) {
            mutateAttribute(formMapping.attributes["age"], age.toString());
          }
        }
      } catch (error) {
        console.error("Error processing SA ID:", error);
      }
    }
  }, [currentTei.attributes[formMapping.attributes["sa_id_number"]]]);

  const getTeaMetadata = (attribute) =>
    programMetadata.trackedEntityAttributes.find((tea) => tea.id === attribute);

  const getTeaValue = (attribute) =>
    currentTei.attributes[attribute] ? currentTei.attributes[attribute] : "";

  const populateInputField = (attribute, forceCompulsory) => {
    const tea = getTeaMetadata(attribute);
    const value = getTeaValue(attribute);
    if (tea) {
      return (
        <InputField
          value={value}
          valueType={tea.valueType}
          label={tea.displayFormName}
          valueSet={tea.valueSet}
          change={(newValue) => {
            // Add validation for SA ID number
            if (attribute === formMapping.attributes["sa_id_number"]) {
              // Only allow numbers and limit to 13 digits
              const numericValue = newValue.replace(/[^0-9]/g, "");
              if (numericValue.length <= 13) {
                mutateAttribute(tea.id, numericValue);
              }
            } else {
              mutateAttribute(tea.id, newValue);
            }
          }}
          disabled={
            attribute === formMapping.attributes["system_id"] ||
            enrollmentStatus === "COMPLETED"
          }
          mandatory={
            forceCompulsory !== undefined ? forceCompulsory : tea.compulsory
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
    const estimatedAge = getTeaMetadata(
      formMapping.attributes["estimated_age"]
    );
    const ageUnit = getTeaMetadata(formMapping.attributes["age_unit"]);
    return (
      <>
        <Row justify="start" align="middle">
          <Col>
            <InputField
              value={getTeaValue(formMapping.attributes["estimated_dob"])}
              valueType={isEstimated.valueType}
              // label={}
              valueSet={isEstimated.valueSet}
              change={(value) => {
                mutateAttribute(isEstimated.id, value);
              }}
              disabled={enrollmentStatus === "COMPLETED"}
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
              // valueType={dob.valueType}
              valueType={"DATE_WITH_RANGE"}
              label={dob.displayFormName}
              valueSet={dob.valueSet}
              change={(value) => {
                console.log(value);
                mutateAttribute(dob.id, value);
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
                if (age_cal > 150)
                  message.error("Age can't be greater than 150");
                else if (age_cal < 0)
                  message.error("Age can't be negative number");
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
                        moment(
                          currentEnrollment.incidentDate,
                          "YYYY-MM-DD"
                        ).diff(
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
                      mutateAttribute(
                        formMapping.attributes["age_unit"],
                        "P_D"
                      );
                    } else {
                      mutateAttribute(
                        formMapping.attributes["estimated_age"],
                        age_cal_in_months + ""
                      );
                      mutateAttribute(
                        formMapping.attributes["age_unit"],
                        "P_M"
                      );
                    }
                  } else {
                    mutateAttribute(
                      formMapping.attributes["estimated_age"],
                      age_cal + ""
                    );
                    mutateAttribute(formMapping.attributes["age_unit"], "P_YD");
                  }
                }
              }}
              disabledDate={(current) =>
                current && current >= moment().startOf("day")
              }
              disabled={
                enrollmentStatus === "COMPLETED" ||
                getTeaValue(formMapping.attributes["estimated_dob"]) === true ||
                getTeaValue(formMapping.attributes["estimated_dob"]) === "true"
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
                (getTeaValue(formMapping.attributes["estimated_dob"]) !==
                  true &&
                  getTeaValue(formMapping.attributes["estimated_dob"]) !==
                    "true")
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
                (getTeaValue(formMapping.attributes["estimated_dob"]) !==
                  true &&
                  getTeaValue(formMapping.attributes["estimated_dob"]) !==
                    "true")
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

      {populateInputField(formMapping.attributes["notification_date"])}

      {/*         
        SA Custom Changes - 01/06/2025
        Sort Order
    */}
      {populateInputField(formMapping.attributes["system_id"])}
      {populateInputField(formMapping.attributes["barcode_number"])}

       {populateInputField(formMapping.attributes["identification_type"])}

      {/* Conditional rendering of ID fields based on identification type */}
      {currentTei.attributes[formMapping.attributes["identification_type"]] ===
        "ID_TYPE_SA" &&
        populateInputField(formMapping.attributes["sa_id_number"], true)}
      {currentTei.attributes[formMapping.attributes["identification_type"]] ===
        "ID_TYPE_PASSPORT" &&
        populateInputField(formMapping.attributes["passport_number"], true)}

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

      {populateInputField(formMapping.attributes["notification_date"])}

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
