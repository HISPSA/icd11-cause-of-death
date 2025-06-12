import { useState, useEffect } from "react";
import { connect } from "react-redux";

import { Button, Modal, Tooltip } from "antd";

/* Styling tools */
import { useTranslation } from "react-i18next";
import moment from "moment";
import InputField from "../InputField";
import Icd11Tool from "../Icd11Tool/EmbeddedIcd11Tool";
import "./stage.css";

/* REDUX */

import {
  mutateEvent,
  mutateDataValue,
  initNewEvent,
} from "../../redux/actions/data";

/* Utils */
import { generateCode } from "../../utils";

const Stage = ({
  metadata,
  data,
  mutateEvent,
  mutateDataValue,
  initNewEvent,
}) => {
  const { t } = useTranslation();

  const [icdTool, setIcdTool] = useState(false);
  const [activeCauseOfDeath, setActiveCauseOfDeath] = useState("");
  const [causeOfDeaths, setCauseOfDeaths] = useState(null);
  const [checkBoxUnderlying, setCheckBoxUnderlying] = useState("");
  const [flagUnderlying, setFlagUnderlying] = useState(false);

  const [underlyingSelections, setUnderlyingSelections] = useState([]);
  const [underlyingResult, setUnderlyingResult] = useState("");
  const [underlyingModal, setUnderlyingModal] = useState(false);
  const [timeToDeath, setTimeToDeath] = useState(null);
  const [timeToDeathModal, setTimeToDeathModal] = useState(false);

  const {
    currentEnrollment,
    currentTei: { attributes },
    currentEnrollment: { enrollmentDate: currentTeiDateOfDeath },
    currentEnrollment: { status: enrollmentStatus },
    currentEvents,
  } = data;
  const {
    programMetadata,
    formMapping,
    icd11Options,
    femaleCode,
    icdApi_clientToken,
    keyUiLocale,
  } = metadata;
  const currentTeiSexAttributeValue = attributes[formMapping.attributes["sex"]];
  const currentTeiDateOfBirthAttributeValue =
    attributes[formMapping.attributes["dob"]];
  const currentTeiAgeAttributeValue = attributes[formMapping.attributes["age"]];

  const currentEvent = currentEvents.find((event) => {
    return event.programStage === formMapping.programStage;
  });

  // Add useEffect for mother's SA ID processing
  useEffect(() => {
    if (!currentEvent) return;

    const motherIdNumber = currentEvent.dataValues[formMapping.dataElements["mother_identity_number"]];
    const motherIdType = currentEvent.dataValues[formMapping.dataElements["mother_identification_type"]];


    // Only process if we have a complete 13-digit ID number and correct ID type
    if (
      motherIdType === "ID_TYPE_SA" &&
      motherIdNumber &&
      motherIdNumber.length === 13 &&
      /^\d+$/.test(motherIdNumber)
    ) {
      try {
        const year = parseInt(motherIdNumber.substring(0, 2));
        const month = motherIdNumber.substring(2, 4);
        const day = motherIdNumber.substring(4, 6);

        // Validate month and day
        if (parseInt(month) < 1 || parseInt(month) > 12) {
          return;
        }
        if (parseInt(day) < 1 || parseInt(day) > 31) {
          return;
        }

        // Determine full year (assuming 1900s for now)
        const fullYear = year < 50 ? 2000 + year : 1900 + year;

        // Create date string in YYYY-MM-DD format
        const dob = `${fullYear}-${month}-${day}`;

        // Validate if it's a valid date
        if (moment(dob, "YYYY-MM-DD", true).isValid()) {
          // Update the mother's DOB field
          mutateDataValue(currentEvent.event, formMapping.dataElements["mother_dob"], dob);

          // Calculate and update mother's age
          const age = moment().diff(moment(dob), "years");
          if (age >= 0 && age <= 150) {
            mutateDataValue(currentEvent.event, formMapping.dataElements["mother_age"], age.toString());
          } 
        } 
      } catch (error) {
        console.error("Error processing mother's SA ID:", error);
      }
    } else if (motherIdType === "ID_TYPE_SA" && motherIdNumber) {
      if (motherIdNumber.length !== 13) {
        console.log("ID number must be 13 digits");
      } else if (!/^\d+$/.test(motherIdNumber)) {
        console.log("ID number must contain only digits");
      }
    }
  }, [currentEvent?.dataValues[formMapping.dataElements["mother_identity_number"]]]);

  const age = currentTeiAgeAttributeValue
    ? currentTeiAgeAttributeValue
    : Math.abs(
        moment(currentTeiDateOfDeath, "YYYY-MM-DD").diff(
          moment(currentTeiDateOfBirthAttributeValue, "YYYY-MM-DD"),
          "years",
          true
        )
      );
  const programStage = programMetadata.programStages.find(
    (ps) => ps.id === formMapping.programStage
  );
  const returnInitValue = (de) => {
    return currentEvent
      ? currentEvent.dataValues[de]
        ? currentEvent.dataValues[de]
        : ""
      : "";
  };
  const isShowMaternalDeath = () =>
    currentTeiSexAttributeValue === femaleCode && age >= 10;
  const isShowFetalOrInfantDeath = () => age <= 1;

  useEffect(() => {
    if (
      formMapping.sections.find(
        ({ name }) => name === "Fetal or infant death"
      ) &&
      currentEvent &&
      !isShowFetalOrInfantDeath()
    ) {
      [
        formMapping.dataElements["multiple_pregnancies"],
        formMapping.dataElements["stillborn"],
        formMapping.dataElements["hours_newborn_survived"],
        formMapping.dataElements["birth_weight"],
        formMapping.dataElements["completedWeeks_pregnancy"],
        formMapping.dataElements["age_mother"],
        formMapping.dataElements["pregnancy_conditions"],
      ].map((deId) => {
        mutateDataValue(currentEvent.event, deId, "");
      });
      mutateEvent(currentEvent.event, "isDirty", false);
    }
  }, [age]);

  useEffect(() => {
    if (
      formMapping.sections.find(({ name }) => name === "Maternal death") &&
      currentEvent &&
      !isShowMaternalDeath()
    ) {
      [
        formMapping.dataElements["pregnancy_inLastYear"],
        formMapping.dataElements["time_from_pregnancy"],
        formMapping.dataElements["pregnancy_contributed_to_death"],
      ].map((deId) => {
        mutateDataValue(currentEvent.event, deId, "");
      });
      mutateEvent(currentEvent.event, "isDirty", false);
    }
  }, [currentTeiSexAttributeValue, age]);

  useEffect(() => {
    if (!currentEvent) {
      const eventId = generateCode();
      initNewEvent(eventId, programStage.id);
      mutateEvent(eventId, "eventDate", currentEnrollment.incidentDate);
      mutateEvent(eventId, "dueDate", currentEnrollment.incidentDate);

      // Dirty Check
      mutateEvent(eventId, "isDirty", false);
    }
    setUnderlyingResult(
      returnInitValue(formMapping.dataElements["underlyingCOD"])
    );
    const cods = {
      [formMapping.dataElements["codA"]]: {
        code: returnInitValue(formMapping.dataElements["codA"]),
        // label: returnInitValue(formMapping.dataElements["codA_name"]),
        underlying: returnInitValue(
          formMapping.dataElements["codA_underlying"]
        ),
        entityId: returnInitValue(formMapping.dataElements["codA_entityId"]),
      },
      [formMapping.dataElements["codB"]]: {
        code: returnInitValue(formMapping.dataElements["codB"]),
        // label: returnInitValue(formMapping.dataElements["codB_name"]),
        underlying: returnInitValue(
          formMapping.dataElements["codB_underlying"]
        ),
        entityId: returnInitValue(formMapping.dataElements["codB_entityId"]),
      },
      [formMapping.dataElements["codC"]]: {
        code: returnInitValue(formMapping.dataElements["codC"]),
        // label: returnInitValue(formMapping.dataElements["codC_name"]),
        underlying: returnInitValue(
          formMapping.dataElements["codC_underlying"]
        ),
        entityId: returnInitValue(formMapping.dataElements["codC_entityId"]),
      },
      [formMapping.dataElements["codD"]]: {
        code: returnInitValue(formMapping.dataElements["codD"]),
        // label: returnInitValue(formMapping.dataElements["codD_name"]),
        underlying: returnInitValue(
          formMapping.dataElements["codD_underlying"]
        ),
        entityId: returnInitValue(formMapping.dataElements["codD_entityId"]),
      },
      [formMapping.dataElements["codO"]]: {
        code: returnInitValue(formMapping.dataElements["codO"]),
        // label: returnInitValue(formMapping.dataElements["codO_name"]),
        underlying: returnInitValue(
          formMapping.dataElements["codO_underlying"]
        ),
        entityId: returnInitValue(formMapping.dataElements["codO_entityId"]),
      },
    };
    setCauseOfDeaths(cods);
  }, []);

  useEffect(() => {
    causeOfDeaths &&
      setCheckBoxUnderlying(
        causeOfDeaths[formMapping.dataElements["codA"]].underlying
          ? formMapping.dataElements["codA_underlying"]
          : causeOfDeaths[formMapping.dataElements["codB"]].underlying
          ? formMapping.dataElements["codB_underlying"]
          : causeOfDeaths[formMapping.dataElements["codC"]].underlying
          ? formMapping.dataElements["codC_underlying"]
          : causeOfDeaths[formMapping.dataElements["codD"]].underlying
          ? formMapping.dataElements["codD_underlying"]
          : causeOfDeaths[formMapping.dataElements["codO"]].underlying
          ? formMapping.dataElements["codO_underlying"]
          : ""
      );
  }, [causeOfDeaths]);

  useEffect(() => {
    setFlagUnderlying(!flagUnderlying);
  }, [checkBoxUnderlying]);

  useEffect(() => {
    if (causeOfDeaths) {
      fillUpUnderlying(causeOfDeaths);
    }
  }, [flagUnderlying]);

  useEffect(() => {
    if (underlyingResult !== "") {
      fillUpUnderlying(causeOfDeaths);
    }
  }, [underlyingResult]);

  const setValueIcdField = (cod) => {
    if (activeCauseOfDeath !== "") {
      mutateDataValue(
        currentEvent.event,
        activeCauseOfDeath.code,
        cod[activeCauseOfDeath.code].code
      );
      // mutateDataValue(currentEvent.event, activeCauseOfDeath.label, cod[activeCauseOfDeath.code].label);
      mutateDataValue(
        currentEvent.event,
        activeCauseOfDeath.underlying,
        cod[activeCauseOfDeath.code].underlying
      );
      mutateDataValue(
        currentEvent.event,
        activeCauseOfDeath.entityId,
        cod[activeCauseOfDeath.code].entityId
      );

      // RESET activeCauseOfDeath
      setActiveCauseOfDeath("");
    }
  };

  const fillUpUnderlying = (cod) => {
    let result = null;
    // for (const [key, value] of Object.entries(cod)) {
    //   if (value.underlying) {
    result = underlyingResult;
    //   }
    // }

    const currentUnderlyingCoD =
      currentEvent &&
      currentEvent.dataValues[formMapping.dataElements["underlyingCOD_code"]]
        ? currentEvent.dataValues[
            formMapping.dataElements["underlyingCOD_code"]
          ]
        : "";
    // Save values of underlying
    if (currentEvent) {
      if (result && result !== "") {
        if (result !== currentUnderlyingCoD) {
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD"],
            result
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_code"],
            result
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_chapter"],
            icd11Options
              .find((option) => option.code === result)
              .attributeValues.find(
                (attrVal) =>
                  attrVal.attribute.id ===
                  formMapping.optionAttributes["chapter"]
              ).value
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_group"],
            icd11Options
              .find((option) => option.code === result)
              .attributeValues.find(
                (attrVal) =>
                  attrVal.attribute.id === formMapping.optionAttributes["group"]
              ).value
          );
        }
      } else {
        if (currentEvent.isDirty) {
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD"],
            ""
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_code"],
            ""
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_chapter"],
            ""
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_group"],
            ""
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_report"],
            ""
          );
        } else {
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD"],
            ""
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_code"],
            ""
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_chapter"],
            ""
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_group"],
            ""
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_report"],
            ""
          );
          mutateEvent(currentEvent.event, "isDirty", false);
        }
      }
    }
  };

  // Render Inputs ( text, checkbox - note: not for code and label fields)
  const renderInputField = (de, extraFunction, placeholder) => {
    const foundDe = programStage.dataElements.find(
      (dataElement) => dataElement.id === de
    );
    if (!foundDe) {
      return null;
    }
    let disable = false;
    
    // Disable DOB and age fields if using ID number
    if (
      currentEvent?.dataValues[formMapping.dataElements["mother_identification_type"]] === "ID_TYPE_SA" &&
      currentEvent?.dataValues[formMapping.dataElements["mother_identity_number"]]?.length === 13 &&
      (de === formMapping.dataElements["mother_dob"] || de === formMapping.dataElements["mother_age"])
    ) {
      disable = true;
    }

    if (
      currentEvent &&
      de === formMapping.dataElements["reason_of_manual_COD_selection"] &&
      ((currentEvent.dataValues[
        formMapping.dataElements["underlyingCOD_processed_by"]
      ] &&
        currentEvent.dataValues[
          formMapping.dataElements["underlyingCOD_processed_by"]
        ] === "DORIS") ||
        !currentEvent.dataValues[
          formMapping.dataElements["underlyingCOD_processed_by"]
        ])
    ) {
      disable = true;
    }
    if (
      currentEvent &&
      de === formMapping.dataElements["underlyingCOD_processed_by"] &&
      currentEvent.dataValues[
        formMapping.dataElements["underlyingCOD_processed_by"]
      ] !== "Manual" &&
      underlyingResult === ""
    ) {
      disable = true;
    }
    if (
      de === formMapping.dataElements["codA_underlying"] ||
      de === formMapping.dataElements["codB_underlying"] ||
      de === formMapping.dataElements["codC_underlying"] ||
      de === formMapping.dataElements["codD_underlying"] ||
      de === formMapping.dataElements["codO_underlying"]
    ) {
      if (checkBoxUnderlying !== "" && checkBoxUnderlying !== de) {
        disable = true;
      }
      if (
        currentEvent &&
        !currentEvent.dataValues[
          formMapping.dataElements["underlyingCOD_processed_by"]
        ] &&
        checkBoxUnderlying === ""
      ) {
        disable = true;
      }
      if (
        currentEvent &&
        currentEvent.dataValues[
          formMapping.dataElements["underlyingCOD_processed_by"]
        ] &&
        currentEvent.dataValues[
          formMapping.dataElements["underlyingCOD_processed_by"]
        ] === "DORIS"
      ) {
        disable = true;
      }
    }
    return (
      <div>
        <InputField
          value={
            currentEvent && currentEvent.dataValues[de]
              ? currentEvent.dataValues[de]
              : de === formMapping.dataElements["underlyingCOD_processed_by"]
              ? "DORIS"
              : ""
          }
          change={(value) => {
            // Add validation for mother's SA ID number
            if (de === formMapping.dataElements["mother_identity_number"]) {
              // Only allow numbers and limit to 13 digits
              const numericValue = value.replace(/[^0-9]/g, "");
              if (numericValue.length <= 13) {
                mutateDataValue(currentEvent.event, de, numericValue);
              }
            } else {
              // check if input is underlying checkbox
              if (extraFunction) {
                let currentCauseOfDeath = causeOfDeaths;
                let id = null;
                switch (de) {
                  case formMapping.dataElements["codA_underlying"]:
                    id = formMapping.dataElements["codA"];
                    break;
                  case formMapping.dataElements["codB_underlying"]:
                    id = formMapping.dataElements["codB"];
                    break;
                  case formMapping.dataElements["codC_underlying"]:
                    id = formMapping.dataElements["codC"];
                    break;
                  case formMapping.dataElements["codD_underlying"]:
                    id = formMapping.dataElements["codD"];
                    break;
                  case formMapping.dataElements["codO_underlying"]:
                    id = formMapping.dataElements["codO"];
                    break;
                  default:
                    break;
                }

                // set underlying
                if (value) {
                  if (currentCauseOfDeath[id].code.split(",").length === 1) {
                    setUnderlyingResult(
                      currentCauseOfDeath[id].code.split(" (")[0]
                    );
                  } else {
                    setUnderlyingSelections(
                      currentCauseOfDeath[id].code.split(",").map((selection) => ({
                        label: `${selection} - ${
                          icd11Options.find(
                            ({ code }) => code === selection.split(" (")[0]
                          )?.name
                        }`,
                        value: selection.split(" (")[0],
                      }))
                    );
                    setUnderlyingModal(true);
                  }
                } else {
                  setUnderlyingResult("");
                  setUnderlyingSelections([]);
                }

                if (id) {
                  for (const [key, val] of Object.entries(currentCauseOfDeath)) {
                    if (key === id) {
                      val.underlying = value;
                    } else {
                      val.underlying = false;
                    }
                  }

                  setCauseOfDeaths({
                    ...causeOfDeaths,
                    ...currentCauseOfDeath,
                  });
                }
              }
              // set DORIS
              if (
                currentEvent &&
                de === formMapping.dataElements["underlyingCOD_processed_by"] &&
                value === "DORIS"
              ) {
                mutateDataValue(
                  currentEvent.event,
                  formMapping.dataElements["reason_of_manual_COD_selection"],
                  ""
                );
              }
              mutateDataValue(currentEvent.event, de, value);
            }
          }}
          valueType={foundDe.valueType}
          valueSet={foundDe.valueSet}
          disabled={disable || enrollmentStatus === "COMPLETED"}
          placeholder={placeholder}
        />
       
      </div>
    );
  };

  const tagRender = (props) => {
    const { label, value, closable, onClose } = props;
    const option = icd11Options.find(
      (item) => item.code === value.split(" (")[0]
    );

    const displayText = `${value.split(" (")[0]} - ${option?.name}`;

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: "#f0f0f0",
          padding: "4px 8px",
          borderRadius: "4px",
          margin: "2px",
        }}
      >
        {displayText}
        {closable && (
          <span
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              marginLeft: "8px",
              cursor: "pointer",
              color: "#999",
            }}
          >
            ×
          </span>
        )}
      </span>
    );
  };

  // const renderCauseOfDeathsInputField = (codCode, codName, codEntityId, codUnderlying) => {
  const renderCauseOfDeathsInputField = (
    codCode,
    codEntityId,
    codUnderlying
  ) => {
    return (
      <InputField
        // addonBefore={
        //   currentEvent ? currentEvent.dataValues[codCode] ? <b>{currentEvent.dataValues[codCode]}</b> : "" : ""
        // }
        // value={currentEvent ? (currentEvent.dataValues[codCode] ? currentEvent.dataValues[codCode] : "") : ""}
        value={
          currentEvent
            ? currentEvent.dataValues[codCode]
              ? currentEvent.dataValues[codCode].split(",")
              : []
            : []
        }
        valueSet={
          currentEvent
            ? currentEvent.dataValues[codCode]
              ? currentEvent.dataValues[codCode].split(",")
              : []
            : []
        }
        selectMode={"multiple"}
        tagRender={tagRender}
        valueType="TEXT"
        click={() => {
          setActiveCauseOfDeath({
            // ...activeCauseOfDeath,
            // label: codName,
            code: codCode,
            entityId: codEntityId,
            underlying: codUnderlying,
            // freeText: freeText
          });
          setIcdTool(true);
        }}
        placeholder={"ICD-11 Coding Tool"}
        // allowClear={true}
        change={(value) => {
          if (value === "") {
            mutateDataValue(currentEvent.event, codCode, "");
            // mutateDataValue(currentEvent.event, codName, "");
            mutateDataValue(currentEvent.event, codUnderlying, false);
            causeOfDeaths[codCode].code = "";
            // causeOfDeaths[codCode].label = "";
            causeOfDeaths[codCode].underlying = false;
            setCauseOfDeaths({ ...causeOfDeaths });
          }

          let dataValues_codEntityId =
            currentEvent.dataValues[codEntityId].split(",");
          currentEvent.dataValues[codCode].split(",").forEach((c, i) => {
            if (!value.find((v) => c === v)) {
              console.log(c, i);
              // dataValues_codEntityId = dataValues_codEntityId.splice(i,1);
              console.log(dataValues_codEntityId.splice(i, 1));
            }
          });

          causeOfDeaths[formMapping.dataElements["codA"]].underlying = false;
          causeOfDeaths[formMapping.dataElements["codB"]].underlying = false;
          causeOfDeaths[formMapping.dataElements["codC"]].underlying = false;
          causeOfDeaths[formMapping.dataElements["codD"]].underlying = false;
          causeOfDeaths[formMapping.dataElements["codO"]].underlying = false;
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["codA_underlying"],
            false
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["codB_underlying"],
            false
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["codC_underlying"],
            false
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["codD_underlying"],
            false
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["codO_underlying"],
            false
          );

          causeOfDeaths[codCode].code = value.join(",");
          causeOfDeaths[codCode].entityId = dataValues_codEntityId.join(",");
          mutateDataValue(currentEvent.event, codCode, value.join(","));
          mutateDataValue(
            currentEvent.event,
            codEntityId,
            dataValues_codEntityId.join(",")
          );

          setCauseOfDeaths({ ...causeOfDeaths });
          setUnderlyingResult("");

          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_processed_by"],
            "DORIS"
          );
        }}
        disabled={enrollmentStatus === "COMPLETED"}
      />
    );
  };

  // This works with the Maternal Death rule once the section has attribute "programRule" with value "MaternalDeath" in data store
  const renderOtherSection = (section) => {
    return section.programRule !== "MaternalDeath" || isShowMaternalDeath() ? (
      <div className="stage-section">
        <div className="stage-section-title">{section.name}</div>
        <div className="stage-section-content">
          <table className="other-section-table">
            <tbody>
              {section.dataElements.map(({ id }) => (
                <tr>
                  <td>
                    {
                      programMetadata.programStages[0].dataElements.find(
                        (de) => de.id === id
                      ).displayFormName
                    }
                  </td>
                  <td>{renderInputField(id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ) : (
      <></>
    );
  };

  const detectUnderlyingCauseOfDeath = async () => {
    let headers = new Headers();
    headers.append("accept", "application/json");
    headers.append("API-Version", "v2");
    headers.append("Accept-Language", keyUiLocale);
    headers.append("Authorization", `Bearer ${icdApi_clientToken}`);
    const icdApiUrl =
      "https://id.who.int/icd/release/11/2025-01/doris?" +
      "sex=" +
      (!currentTeiSexAttributeValue
        ? "9"
        : currentTeiSexAttributeValue === ""
        ? "9"
        : currentTeiSexAttributeValue === femaleCode
        ? "2"
        : "1") +
      (currentTeiAgeAttributeValue
        ? `&estimatedAge=${attributes[
            formMapping.attributes["age_unit"]
          ].replace("_", attributes[formMapping.attributes["estimated_age"]])}`
        : "") +
      (currentTeiDateOfBirthAttributeValue
        ? `&dateBirth=${currentTeiDateOfBirthAttributeValue}`
        : "") +
      (currentTeiDateOfDeath ? `&dateDeath=${currentTeiDateOfDeath}` : "") +
      ("&causeOfDeathCodeA=" +
        causeOfDeaths[formMapping.dataElements["codA"]].code
          .split(",")
          .map((c) => c.split(" (")[0])
          .join(",")) +
      (causeOfDeaths[formMapping.dataElements["codB"]].code !== ""
        ? "&causeOfDeathCodeB=" +
          causeOfDeaths[formMapping.dataElements["codB"]].code
            .split(",")
            .map((c) => c.split(" (")[0])
            .join(",")
        : "") +
      (causeOfDeaths[formMapping.dataElements["codC"]].code !== ""
        ? "&causeOfDeathCodeC=" +
          causeOfDeaths[formMapping.dataElements["codC"]].code
            .split(",")
            .map((c) => c.split(" (")[0])
            .join(",")
        : "") +
      (causeOfDeaths[formMapping.dataElements["codD"]].code !== ""
        ? "&causeOfDeathCodeD=" +
          causeOfDeaths[formMapping.dataElements["codD"]].code
            .split(",")
            .map((c) => c.split(" (")[0])
            .join(",")
        : "") +
      (causeOfDeaths[formMapping.dataElements["codO"]].code !== ""
        ? "&causeOfDeathCodeE=" +
          causeOfDeaths[formMapping.dataElements["codO"]].code
            .split(",")
            .map((c) => c.split(" (")[0])
            .join(",")
        : "") +
      ("&intervalA=" +
        causeOfDeaths[formMapping.dataElements["codA"]].code
          .split(",")
          .map((c) => c.split(" (")[1]?.replace(")", "") ?? "")
          .join(",")) +
      (causeOfDeaths[formMapping.dataElements["codB"]].code !== ""
        ? "&intervalB=" +
          causeOfDeaths[formMapping.dataElements["codB"]].code
            .split(",")
            .map((c) => c.split(" (")[1]?.replace(")", "") ?? "")
            .join(",")
        : "") +
      (causeOfDeaths[formMapping.dataElements["codC"]].code !== ""
        ? "&intervalC=" +
          causeOfDeaths[formMapping.dataElements["codC"]].code
            .split(",")
            .map((c) => c.split(" (")[1]?.replace(")", "") ?? "")
            .join(",")
        : "") +
      (causeOfDeaths[formMapping.dataElements["codD"]].code !== ""
        ? "&intervalD=" +
          causeOfDeaths[formMapping.dataElements["codD"]].code
            .split(",")
            .map((c) => c.split(" (")[1]?.replace(")", "") ?? "")
            .join(",")
        : "") +
      (causeOfDeaths[formMapping.dataElements["codO"]].code !== ""
        ? "&intervalE=" +
          causeOfDeaths[formMapping.dataElements["codO"]].code
            .split(",")
            .map((c) => c.split(" (")[1]?.replace(")", "") ?? "")
            .join(",")
        : "") +
      (currentEvent.dataValues[formMapping.dataElements["surgery"]] &&
      currentEvent.dataValues[formMapping.dataElements["surgery"]] !== ""
        ? "&surgeryWasPerformed=" +
          currentEvent.dataValues[formMapping.dataElements["surgery"]]
        : "") +
      (currentEvent.dataValues[formMapping.dataElements["surgery_date"]] &&
      currentEvent.dataValues[formMapping.dataElements["surgery_date"]] !== ""
        ? "&surgeryDate=" +
          currentEvent.dataValues[formMapping.dataElements["surgery_date"]]
        : "") +
      (currentEvent.dataValues[formMapping.dataElements["surgery_reason"]] &&
      currentEvent.dataValues[formMapping.dataElements["surgery_reason"]] !== ""
        ? "&surgeryReason=" +
          currentEvent.dataValues[formMapping.dataElements["surgery_reason"]]
        : "") +
      (currentEvent.dataValues[formMapping.dataElements["autopsy"]] &&
      currentEvent.dataValues[formMapping.dataElements["autopsy"]] !== ""
        ? "&autopsyWasRequested=" +
          currentEvent.dataValues[formMapping.dataElements["autopsy"]]
        : "") +
      (currentEvent.dataValues[formMapping.dataElements["autopsy_specified"]] &&
      currentEvent.dataValues[formMapping.dataElements["autopsy_specified"]] !==
        ""
        ? "&autopsyFindings=" +
          currentEvent.dataValues[formMapping.dataElements["autopsy_specified"]]
        : "") +
      (currentEvent.dataValues[formMapping.dataElements["mannerOfDeath"]] &&
      currentEvent.dataValues[formMapping.dataElements["mannerOfDeath"]] !== ""
        ? "&mannerOfDeath=" +
          currentEvent.dataValues[formMapping.dataElements["mannerOfDeath"]]
        : "") +
      (currentEvent.dataValues[formMapping.dataElements["dateOfInjury"]] &&
      currentEvent.dataValues[formMapping.dataElements["dateOfInjury"]] !== ""
        ? "&mannerOfDeathDateOfExternalCauseOrPoisoning=" +
          currentEvent.dataValues[formMapping.dataElements["dateOfInjury"]]
        : "") +
      (currentEvent.dataValues[formMapping.dataElements["externalCause"]] &&
      currentEvent.dataValues[formMapping.dataElements["externalCause"]] !== ""
        ? "&mannerOfDeathDescriptionExternalCause=" +
          currentEvent.dataValues[formMapping.dataElements["externalCause"]]
        : "") +
      (currentEvent.dataValues[
        formMapping.dataElements["externalCause_place"]
      ] &&
      currentEvent.dataValues[
        formMapping.dataElements["externalCause_place"]
      ] !== ""
        ? "&mannerOfDeathPlaceOfOccuranceExternalCause=" +
          currentEvent.dataValues[
            formMapping.dataElements["externalCause_place"]
          ]
        : "") +
      (currentEvent.dataValues[
        formMapping.dataElements["multiple_pregnancies"]
      ] &&
      currentEvent.dataValues[
        formMapping.dataElements["multiple_pregnancies"]
      ] !== ""
        ? "&=fetalOrInfantDeathMultiplePregnancy" +
          currentEvent.dataValues[
            formMapping.dataElements["multiple_pregnancies"]
          ]
        : "") +
      (currentEvent.dataValues[formMapping.dataElements["stillborn"]] &&
      currentEvent.dataValues[formMapping.dataElements["stillborn"]] !== ""
        ? "&=fetalOrInfantDeathStillborn" +
          currentEvent.dataValues[formMapping.dataElements["stillborn"]]
        : "") +
      (currentEvent.dataValues[
        formMapping.dataElements["hours_newborn_survived"]
      ] &&
      currentEvent.dataValues[
        formMapping.dataElements["hours_newborn_survived"]
      ] !== ""
        ? "&=fetalOrInfantDeathDeathWithin24h" +
          currentEvent.dataValues[
            formMapping.dataElements["hours_newborn_survived"]
          ]
        : "") +
      (currentEvent.dataValues[formMapping.dataElements["birth_weight"]] &&
      currentEvent.dataValues[formMapping.dataElements["birth_weight"]] !== ""
        ? "&=fetalOrInfantDeathBirthWeight" +
          currentEvent.dataValues[formMapping.dataElements["birth_weight"]]
        : "") +
      (currentEvent.dataValues[
        formMapping.dataElements["completedWeeks_pregnancy"]
      ] &&
      currentEvent.dataValues[
        formMapping.dataElements["completedWeeks_pregnancy"]
      ] !== ""
        ? "&=fetalOrInfantDeathPregnancyWeeks" +
          currentEvent.dataValues[
            formMapping.dataElements["completedWeeks_pregnancy"]
          ]
        : "") +
      (currentEvent.dataValues[formMapping.dataElements["age_mother"]] &&
      currentEvent.dataValues[formMapping.dataElements["age_mother"]] !== ""
        ? "&=fetalOrInfantDeathAgeMother" +
          currentEvent.dataValues[formMapping.dataElements["age_mother"]]
        : "") +
      (currentEvent.dataValues[
        formMapping.dataElements["pregnancy_conditions"]
      ] &&
      currentEvent.dataValues[
        formMapping.dataElements["pregnancy_conditions"]
      ] !== ""
        ? "&=fetalOrInfantDeathPerinatalDescription" +
          currentEvent.dataValues[
            formMapping.dataElements["pregnancy_conditions"]
          ]
        : "") +
      (currentEvent.dataValues[
        formMapping.dataElements["pregnancy_inLastYear"]
      ] &&
      currentEvent.dataValues[
        formMapping.dataElements["pregnancy_inLastYear"]
      ] !== ""
        ? "&=maternalDeathWasPregnant" +
          currentEvent.dataValues[
            formMapping.dataElements["pregnancy_inLastYear"]
          ]
        : "") +
      (currentEvent.dataValues[
        formMapping.dataElements["time_from_pregnancy"]
      ] &&
      currentEvent.dataValues[
        formMapping.dataElements["time_from_pregnancy"]
      ] !== ""
        ? "&=maternalDeathTimeFromPregnancy" +
          currentEvent.dataValues[
            formMapping.dataElements["time_from_pregnancy"]
          ]
        : "") +
      (currentEvent.dataValues[
        formMapping.dataElements["pregnancy_contributed_to_death"]
      ] &&
      currentEvent.dataValues[
        formMapping.dataElements["pregnancy_contributed_to_death"]
      ] !== ""
        ? "&=maternalDeathPregnancyContribute" +
          currentEvent.dataValues[
            formMapping.dataElements["pregnancy_contributed_to_death"]
          ]
        : "");
    const result = await fetch(icdApiUrl, {
      headers: headers,
    })
      .then((result) => {
        return result.json();
      })
      .catch((err) => {
        return err;
      });
    const underlyingCode = result.stemCode;

    if (underlyingCode !== "") {
      const cods = {
        [formMapping.dataElements["codA"]]: {
          ...causeOfDeaths[formMapping.dataElements["codA"]],
          underlying:
            causeOfDeaths[formMapping.dataElements["codA"]].code.includes(
              underlyingCode
            ),
        },
        [formMapping.dataElements["codB"]]: {
          ...causeOfDeaths[formMapping.dataElements["codB"]],
          underlying:
            causeOfDeaths[formMapping.dataElements["codB"]].code.includes(
              underlyingCode
            ),
        },
        [formMapping.dataElements["codC"]]: {
          ...causeOfDeaths[formMapping.dataElements["codC"]],
          underlying:
            causeOfDeaths[formMapping.dataElements["codC"]].code.includes(
              underlyingCode
            ),
        },
        [formMapping.dataElements["codD"]]: {
          ...causeOfDeaths[formMapping.dataElements["codD"]],
          underlying:
            causeOfDeaths[formMapping.dataElements["codD"]].code.includes(
              underlyingCode
            ),
        },
        [formMapping.dataElements["codO"]]: {
          ...causeOfDeaths[formMapping.dataElements["codO"]],
          underlying:
            causeOfDeaths[formMapping.dataElements["codO"]].code.includes(
              underlyingCode
            ),
        },
      };

      mutateDataValue(
        currentEvent.event,
        formMapping.dataElements["codA_underlying"],
        cods[formMapping.dataElements["codA"]].underlying
      );
      mutateDataValue(
        currentEvent.event,
        formMapping.dataElements["codB_underlying"],
        cods[formMapping.dataElements["codB"]].underlying
      );
      mutateDataValue(
        currentEvent.event,
        formMapping.dataElements["codC_underlying"],
        cods[formMapping.dataElements["codC"]].underlying
      );
      mutateDataValue(
        currentEvent.event,
        formMapping.dataElements["codD_underlying"],
        cods[formMapping.dataElements["codD"]].underlying
      );
      mutateDataValue(
        currentEvent.event,
        formMapping.dataElements["codO_underlying"],
        cods[formMapping.dataElements["codO"]].underlying
      );
      mutateDataValue(
        currentEvent.event,
        formMapping.dataElements["underlyingCOD_report"],
        result.report
      );
      mutateDataValue(
        currentEvent.event,
        formMapping.dataElements["underlyingCOD_warning"],
        result.warning ?? ""
      );
      // mutateDataValue(currentEvent.event, formMapping.dataElements["underlyingCOD_report"], result.UCComputed?.Report ?? result.UCComputed?.Errors ?? "");

      mutateDataValue(
        currentEvent.event,
        formMapping.dataElements["underlyingCOD_processed_by"],
        "DORIS"
      );
      mutateDataValue(
        currentEvent.event,
        formMapping.dataElements["reason_of_manual_COD_selection"],
        ""
      ); // For clearing the value of reason for the manual selection

      mutateDataValue(
        currentEvent.event,
        formMapping.dataElements["underlyingCOD_DORIS"],
        underlyingCode
      );

      setUnderlyingResult(underlyingCode);
      setCauseOfDeaths(cods);
    } else {
      mutateDataValue(
        currentEvent.event,
        formMapping.dataElements["underlyingCOD_warning"],
        result.warning ?? ""
      );
    }
  };

  // const getUcodResult = () => currentEvent && currentEvent.dataValues[formMapping.dataElements["underlyingCOD_report"]] ? currentEvent.dataValues[formMapping.dataElements["underlyingCOD_report"]] : t("note_WHO_digital_open_rule_integrated_cause_of_death_selection_Doris");

  return (
    <>
      <Modal
        style={{ top: 250 }}
        closable={false}
        title="Select underlying cause of death"
        open={underlyingModal}
        footer={[
          <Button
            onClick={() => {
              setUnderlyingModal(false);
            }}
            disabled={underlyingResult === ""}
          >
            Close
          </Button>,
        ]}
      >
        <InputField
          valueType="TEXT"
          valueSet={underlyingSelections}
          value={underlyingResult}
          change={(selected) => {
            setUnderlyingResult(selected);
          }}
        />
      </Modal>
      <Modal
        style={{ top: 250 }}
        closable={false}
        width={"40%"}
        title={`${timeToDeath?.causeLabel} - Time from onset to death`}
        open={timeToDeathModal}
        footer={[
          <Button
            type="primary"
            onClick={() => {
              mutateDataValue(
                currentEvent.event,
                timeToDeath.causeId,
                timeToDeath.timeInterval.reduce((accumulator, currentValue) => {
                  return accumulator === ""
                    ? `${currentValue.code} (${currentValue.time})`
                    : `${accumulator},${currentValue.code} (${currentValue.time})`;
                }, "")
              );
              causeOfDeaths[timeToDeath.causeId].code =
                timeToDeath.timeInterval.reduce((accumulator, currentValue) => {
                  return accumulator === ""
                    ? `${currentValue.code} (${currentValue.time})`
                    : `${accumulator},${currentValue.code} (${currentValue.time})`;
                }, "");
              setCauseOfDeaths({ ...causeOfDeaths });
              setTimeToDeathModal(false);
            }}
            style={{ width: "100px" }}
          >
            Set
          </Button>,
          <Button
            onClick={() => {
              setTimeToDeathModal(false);
            }}
            style={{ width: "100px" }}
          >
            Close
          </Button>,
        ]}
      >
        <table width={"100%"}>
          {currentEvent &&
            timeToDeath &&
            timeToDeath.timeInterval.map(({ code, time }) => {
              // const selection = code.split(" (")[0];
              // let selectionTime = code.split(" (")[1]?.replace(")","");

              return (
                <tr>
                  <td width={"50%"}>{`${code} - ${
                    icd11Options.find((option) => option.code === code)?.name
                  }`}</td>
                  <td width={"25%"}>
                    <InputField
                      valueSet={[
                        {
                          label: "Years",
                          value: "year",
                        },
                        {
                          label: "Months",
                          value: "month",
                        },
                        {
                          label: "Weeks",
                          value: "week",
                        },
                        {
                          label: "Days",
                          value: "day",
                        },
                        {
                          label: "Hours",
                          value: "hour",
                        },
                        {
                          label: "Minutes",
                          value: "minute",
                        },
                        {
                          label: "Seconds",
                          value: "second",
                        },
                        {
                          label: "Unknown",
                          value: "unknown",
                        },
                      ]}
                      placeholder="Time unit"
                      valueType="TEXT"
                      change={(value) => {
                        setTimeToDeath({
                          ...timeToDeath,
                          timeInterval: timeToDeath.timeInterval.map((t) => {
                            if (t.code === code) {
                              return {
                                ...t,
                                time:
                                  value === "unknown"
                                    ? undefined
                                    : value === "year"
                                    ? `P${
                                        !time
                                          ? ""
                                          : time.substring(0, 2) === "PT"
                                          ? time.substring(2, time.length - 1)
                                          : time.substring(1, time.length - 1)
                                      }Y`
                                    : value === "month"
                                    ? `P${
                                        !time
                                          ? ""
                                          : time.substring(0, 2) === "PT"
                                          ? time.substring(2, time.length - 1)
                                          : time.substring(1, time.length - 1)
                                      }M`
                                    : value === "week"
                                    ? `P${
                                        !time
                                          ? ""
                                          : time.substring(0, 2) === "PT"
                                          ? time.substring(2, time.length - 1)
                                          : time.substring(1, time.length - 1)
                                      }W`
                                    : value === "day"
                                    ? `P${
                                        !time
                                          ? ""
                                          : time.substring(0, 2) === "PT"
                                          ? time.substring(2, time.length - 1)
                                          : time.substring(1, time.length - 1)
                                      }D`
                                    : value === "hour"
                                    ? `PT${
                                        !time
                                          ? ""
                                          : time.substring(0, 2) === "PT"
                                          ? time.substring(2, time.length - 1)
                                          : time.substring(1, time.length - 1)
                                      }H`
                                    : value === "minute"
                                    ? `PT${
                                        !time
                                          ? ""
                                          : time.substring(0, 2) === "PT"
                                          ? time.substring(2, time.length - 1)
                                          : time.substring(1, time.length - 1)
                                      }M`
                                    : value === "second"
                                    ? `PT${
                                        !time
                                          ? ""
                                          : time.substring(0, 2) === "PT"
                                          ? time.substring(2, time.length - 1)
                                          : time.substring(1, time.length - 1)
                                      }S`
                                    : undefined,
                              };
                            } else return t;
                          }),
                        });
                      }}
                      value={
                        !time
                          ? "unknown"
                          : time[time.length - 1] === "Y"
                          ? "year"
                          : time[time.length - 1] === "W"
                          ? "week"
                          : time[time.length - 1] === "D"
                          ? "day"
                          : time[time.length - 1] === "H"
                          ? "hour"
                          : time[time.length - 1] === "S"
                          ? "second"
                          : time[time.length - 1] === "M"
                          ? time.substring(0, 2) === "PT"
                            ? "minute"
                            : "month"
                          : "unknown"
                      }
                    />
                  </td>
                  <td width={"25%"}>
                    <InputField
                      valueType="INTEGER_POSITIVE"
                      placeholder="Time interval"
                      change={(value) => {
                        setTimeToDeath({
                          ...timeToDeath,
                          timeInterval: timeToDeath.timeInterval.map((t) => {
                            if (t.code === code) {
                              return {
                                ...t,
                                time: !time
                                  ? undefined
                                  : time.substring(0, 2) === "PT"
                                  ? `PT${value}${time[time.length - 1]}`
                                  : `P${value}${time[time.length - 1]}`,
                              };
                            } else return t;
                          }),
                        });
                      }}
                      value={
                        !time
                          ? ""
                          : time.substring(0, 2) === "PT"
                          ? time.substring(2, time.length - 1)
                          : time.substring(1, time.length - 1)
                      }
                    />
                  </td>
                </tr>
              );
            })}
        </table>
      </Modal>
      <Icd11Tool
        visible={icdTool}
        setVisible={setIcdTool}
        onSelect={(cod) => {
          const selectedCod = {
            code: cod.code,
            // label: cod.title
            //   .replace(/<em class='found'>/g, "")
            //   .replace(/<em class='nonwbe'>/g, "")
            //   .replace(/<[/]em>/g, ""),
            uri: cod.foundationUri,
          };
          causeOfDeaths[activeCauseOfDeath.code].code =
            causeOfDeaths[activeCauseOfDeath.code].code === ""
              ? selectedCod.code
              : `${causeOfDeaths[activeCauseOfDeath.code].code},${
                  selectedCod.code
                }`;
          // causeOfDeaths[activeCauseOfDeath.code].label = selectedCod.label;
          causeOfDeaths[formMapping.dataElements["codA"]].underlying = false;
          causeOfDeaths[formMapping.dataElements["codB"]].underlying = false;
          causeOfDeaths[formMapping.dataElements["codC"]].underlying = false;
          causeOfDeaths[formMapping.dataElements["codD"]].underlying = false;
          causeOfDeaths[formMapping.dataElements["codO"]].underlying = false;
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["codA_underlying"],
            false
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["codB_underlying"],
            false
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["codC_underlying"],
            false
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["codD_underlying"],
            false
          );
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["codO_underlying"],
            false
          );
          causeOfDeaths[activeCauseOfDeath.code].entityId =
            causeOfDeaths[activeCauseOfDeath.code].entityId === ""
              ? selectedCod.uri.split("/")[
                  selectedCod.uri.split("/").length - 1
                ]
              : `${causeOfDeaths[activeCauseOfDeath.code].entityId},${
                  selectedCod.uri.split("/")[
                    selectedCod.uri.split("/").length - 1
                  ]
                }`;
          setValueIcdField(causeOfDeaths);
          setCauseOfDeaths({ ...causeOfDeaths });
          setUnderlyingResult("");
          mutateDataValue(
            currentEvent.event,
            formMapping.dataElements["underlyingCOD_processed_by"],
            "DORIS"
          );
        }}
        defaultValue={{
          // title: (currentEvent && currentEvent.dataValues[activeCauseOfDeath.label]) || "",
          // code: (currentEvent && currentEvent.dataValues[activeCauseOfDeath.code]) || ""
          title: "",
          code: "",
        }}
        // freeText={(currentEvent && currentEvent.dataValues[activeCauseOfDeath.freeText]) || ""}
      />
      <div>
        {/* <Tabs defaultActiveKey="1" type="card">
          <TabPane tab="Frame A" key="a"> */}
        {/* <div className="tab-container"> */}
        <div className="stage-section">
          <div className="stage-section-title">Period of death</div>
          <div className="stage-section-content">
            {renderInputField(formMapping.dataElements["period_of_death"])}
          </div>
        </div>

        <div className="stage-section">
          <div className="stage-section-title">
            Method and Autopsy Information
          </div>
          <div className="stage-section-content">
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
                Method used to ascertain cause of death
              </div>
              {renderInputField(
                formMapping.dataElements["method_to_ascertain_cause_of_death"]
              )}
          
            </div>
            {currentEvent?.dataValues[
              formMapping.dataElements["method_to_ascertain_cause_of_death"]
            ] === "METHOD_AUTOPSY" && (
              <div>
                <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
                  Autopsy information
                </div>
                {renderInputField(formMapping.dataElements["autopsy_info"])}
              </div>
            )}
          </div>
        </div>

        {/* G1 Section: Medical Data */}
        {currentEvent.dataValues[formMapping.dataElements["period_of_death"]] === "TIMING_AFTER_WEEK" && (
          <>
            <div className="stage-section">
              <div className="stage-section-title">G1: Medical Data</div>
              <div className="stage-section-content">
                <table className="medical-data-table">
                  <tbody>
                    <tr>
                      <td
                        colSpan="3"
                        style={{
                          fontWeight: "bold",
                          textAlign: "left",
                          backgroundColor: "#f5f5f5",
                        }}
                      >
                        {t("reasonLeadingToDeath")}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "90%" }}>{t("causeOfDeath")}</td>
                      <td>{t("underlying")}</td>
                    </tr>
                    <tr>
                      <td>
                        <div
                          style={{
                            fontWeight: "bold",
                            textAlign: "left",
                            marginBottom: "5px",
                          }}
                        >
                          Immediate cause of death
                        </div>
                        <div className="two-fields-container">
                          {renderCauseOfDeathsInputField(
                            formMapping.dataElements["codA"],
                            formMapping.dataElements["codA_entityId"],
                            formMapping.dataElements["codA_underlying"],
                            formMapping.dataElements["codA_other_name"]
                          )}
                          {renderInputField(
                            formMapping.dataElements["codA_other_name"],
                            undefined,
                            "A (Free text)"
                          )}
                          <div
                            style={{
                              width: "20%",
                              margin: "5px",
                            }}
                          >
                            <Tooltip
                              className={"custom-tooltip"}
                              title={t("timeFromOnsetToDeath")}
                            >
                              <Button
                                style={{
                                  width: "100%",
                                }}
                                disabled={
                                  !currentEvent?.dataValues[
                                    formMapping.dataElements["codA"]
                                  ] || enrollmentStatus === "COMPLETED"
                                }
                                onClick={() => {
                                  setTimeToDeathModal(true);
                                  setTimeToDeath({
                                    causeId: formMapping.dataElements["codA"],
                                    causeLabel: "Immediate cause of death",
                                    timeInterval: currentEvent.dataValues[
                                      formMapping.dataElements["codA"]
                                    ]
                                      .split(",")
                                      .map((codeSelection) => {
                                        return {
                                          code: codeSelection.split(" (")[0],
                                          time: codeSelection
                                            .split(" (")[1]
                                            ?.replace(")", ""),
                                        };
                                      }),
                                  });
                                }}
                              >
                                <span
                                  style={{
                                    width: "100%",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "inline-block",
                                  }}
                                >
                                  {t("timeFromOnsetToDeath")}
                                </span>
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      </td>
                      <td>
                        {renderInputField(
                          formMapping.dataElements["codA_underlying"],
                          "underlying"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div
                          style={{
                            fontWeight: "bold",
                            textAlign: "left",
                            marginBottom: "5px",
                          }}
                        >
                          Condition leading to immediate cause
                        </div>
                        <div className="two-fields-container">
                          {renderCauseOfDeathsInputField(
                            formMapping.dataElements["codB"],
                            formMapping.dataElements["codB_entityId"],
                            formMapping.dataElements["codB_underlying"],
                            formMapping.dataElements["codB_other_name"]
                          )}
                          {renderInputField(
                            formMapping.dataElements["codB_other_name"],
                            undefined,
                            "B (Free text)"
                          )}
                          <div
                            style={{
                              width: "20%",
                              margin: "5px",
                            }}
                          >
                            <Tooltip
                              className={"custom-tooltip"}
                              title={t("timeFromOnsetToDeath")}
                            >
                              <Button
                                style={{
                                  width: "100%",
                                }}
                                disabled={
                                  !currentEvent?.dataValues[
                                    formMapping.dataElements["codB"]
                                  ] || enrollmentStatus === "COMPLETED"
                                }
                                onClick={() => {
                                  setTimeToDeathModal(true);
                                  setTimeToDeath({
                                    causeId: formMapping.dataElements["codB"],
                                    causeLabel:
                                      "Condition leading to immediate cause",
                                    timeInterval: currentEvent.dataValues[
                                      formMapping.dataElements["codB"]
                                    ]
                                      .split(",")
                                      .map((codeSelection) => {
                                        return {
                                          code: codeSelection.split(" (")[0],
                                          time: codeSelection
                                            .split(" (")[1]
                                            ?.replace(")", ""),
                                        };
                                      }),
                                  });
                                }}
                              >
                                <span
                                  style={{
                                    width: "100%",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "inline-block",
                                  }}
                                >
                                  {t("timeFromOnsetToDeath")}
                                </span>
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      </td>
                      <td>
                        {renderInputField(
                          formMapping.dataElements["codB_underlying"],
                          "underlying"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div
                          style={{
                            fontWeight: "bold",
                            textAlign: "left",
                            marginBottom: "5px",
                          }}
                        >
                          Condition leading to immediate cause
                        </div>
                        <div className="two-fields-container">
                          {renderCauseOfDeathsInputField(
                            formMapping.dataElements["codC"],
                            formMapping.dataElements["codC_entityId"],
                            formMapping.dataElements["codC_underlying"],
                            formMapping.dataElements["codC_other_name"]
                          )}
                          {renderInputField(
                            formMapping.dataElements["codC_other_name"],
                            undefined,
                            "C (Free text)"
                          )}
                          <div
                            style={{
                              width: "20%",
                              margin: "5px",
                            }}
                          >
                            <Tooltip
                              className={"custom-tooltip"}
                              title={t("timeFromOnsetToDeath")}
                            >
                              <Button
                                style={{
                                  width: "100%",
                                }}
                                disabled={
                                  !currentEvent?.dataValues[
                                    formMapping.dataElements["codC"]
                                  ] || enrollmentStatus === "COMPLETED"
                                }
                                onClick={() => {
                                  setTimeToDeathModal(true);
                                  setTimeToDeath({
                                    causeId: formMapping.dataElements["codC"],
                                    causeLabel:
                                      "Condition leading to previous cause",
                                    timeInterval: currentEvent.dataValues[
                                      formMapping.dataElements["codC"]
                                    ]
                                      .split(",")
                                      .map((codeSelection) => {
                                        return {
                                          code: codeSelection.split(" (")[0],
                                          time: codeSelection
                                            .split(" (")[1]
                                            ?.replace(")", ""),
                                        };
                                      }),
                                  });
                                }}
                              >
                                <span
                                  style={{
                                    width: "100%",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "inline-block",
                                  }}
                                >
                                  {t("timeFromOnsetToDeath")}
                                </span>
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      </td>
                      <td>
                        {renderInputField(
                          formMapping.dataElements["codC_underlying"],
                          "underlying"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div
                          style={{
                            fontWeight: "bold",
                            textAlign: "left",
                            marginBottom: "5px",
                          }}
                        >
                          Underlying cause of death
                        </div>
                        <div className="two-fields-container">
                          {renderCauseOfDeathsInputField(
                            formMapping.dataElements["codD"],
                            formMapping.dataElements["codD_entityId"],
                            formMapping.dataElements["codD_underlying"],
                            formMapping.dataElements["codD_other_name"]
                          )}
                          {renderInputField(
                            formMapping.dataElements["codD_other_name"],
                            undefined,
                            "D (Free text)"
                          )}
                          <div
                            style={{
                              width: "20%",
                              margin: "5px",
                            }}
                          >
                            <Tooltip
                              className={"custom-tooltip"}
                              title={t("timeFromOnsetToDeath")}
                            >
                              <Button
                                style={{
                                  width: "100%",
                                }}
                                disabled={
                                  !currentEvent?.dataValues[
                                    formMapping.dataElements["codD"]
                                  ] || enrollmentStatus === "COMPLETED"
                                }
                                onClick={() => {
                                  setTimeToDeathModal(true);
                                  setTimeToDeath({
                                    causeId: formMapping.dataElements["codD"],
                                    causeLabel: "Underlying cause of death",
                                    timeInterval: currentEvent.dataValues[
                                      formMapping.dataElements["codD"]
                                    ]
                                      .split(",")
                                      .map((codeSelection) => {
                                        return {
                                          code: codeSelection.split(" (")[0],
                                          time: codeSelection
                                            .split(" (")[1]
                                            ?.replace(")", ""),
                                        };
                                      }),
                                  });
                                }}
                              >
                                <span
                                  style={{
                                    width: "100%",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "inline-block",
                                  }}
                                >
                                  {t("timeFromOnsetToDeath")}
                                </span>
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      </td>
                      <td>
                        {renderInputField(
                          formMapping.dataElements["codD_underlying"],
                          "underlying"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td
                        // colSpan="2"
                        style={{
                          // fontWeight: "bold",
                          backgroundColor: "#f5f5f5",
                          textAlign: "right",
                        }}
                      >
                        <strong>Underlying Cause of Death processed by:</strong>{" "}
                      </td>
                      <td
                        style={{
                          // fontWeight: "bold",
                          backgroundColor: "#f5f5f5",
                        }}
                      >
                        {renderInputField(
                          formMapping.dataElements["underlyingCOD_processed_by"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td
                        // colSpan="2"
                        style={{
                          // fontWeight: "bold",
                          textAlign: "right",
                          backgroundColor: "#f5f5f5",
                        }}
                      >
                        <strong>DORIS tool:</strong>
                      </td>
                      <td
                        style={{
                          backgroundColor: "#f5f5f5",
                        }}
                      >
                        <Button
                          onClick={() => {
                            detectUnderlyingCauseOfDeath();
                          }}
                          disabled={
                            (currentEvent &&
                              currentEvent.dataValues[
                                formMapping.dataElements[
                                  "underlyingCOD_processed_by"
                                ]
                              ] &&
                              currentEvent.dataValues[
                                formMapping.dataElements[
                                  "underlyingCOD_processed_by"
                                ]
                              ] === "Manual") ||
                            enrollmentStatus === "COMPLETED"
                          }
                        >
                          {t("compute")}
                        </Button>
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan="2"
                        style={{
                          // fontWeight: "bold",
                          textAlign: "right",
                          backgroundColor: "#f5f5f5",
                        }}
                      >
                        <strong>DORIS tool:</strong>
                        <Button
                          onClick={() => {
                            detectUnderlyingCauseOfDeath();
                          }}
                          disabled={
                            (currentEvent &&
                              currentEvent.dataValues[
                                formMapping.dataElements[
                                  "underlyingCOD_processed_by"
                                ]
                              ] &&
                              currentEvent.dataValues[
                                formMapping.dataElements[
                                  "underlyingCOD_processed_by"
                                ]
                              ] === "Manual") ||
                            enrollmentStatus === "COMPLETED"
                          }
                        >
                          {t("compute")}
                        </Button>
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan="2"
                        style={{
                          backgroundColor: "#f5f5f5",
                          textAlign: "right",
                        }}
                      >
                        Reason for Manual Code:
                        {renderInputField(
                          formMapping.dataElements[
                            "reason_of_manual_COD_selection"
                          ]
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* New Pregnancy Status Section for G1 */}
            {currentEvent.dataValues[formMapping.dataElements["period_of_death"]] === "TIMING_AFTER_WEEK" &&
              currentTeiSexAttributeValue === femaleCode && (
                <div className="stage-section">
                  <div className="stage-section-title">Pregnancy Status</div>
                  <div className="stage-section-content">
                    <table className="pregnancy-status-table">
                      <tbody>
                        <tr>
                          <td style={{ width: "90%" }}>
                            Was the deceased pregnant at time of death or up to
                            42 days prior to death
                            <div>
                              {renderInputField(
                                formMapping.dataElements[
                                  "pregnant_at_time_of_birth"
                                ]
                              )}
                            </div>
                          </td>
                          <td>
                            {/* {renderInputField(
                            formMapping.dataElements["pregnant_at_time_of_birth"]
                          )} */}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </>
        )}
        {/* G2 Section: Perinatal Death */}
        {currentEvent.dataValues[formMapping.dataElements["period_of_death"]]  === "TIMING_WITHIN_WEEK" && (
          <div className="stage-section">
            <div className="stage-section-title">G2: Perinatal Death</div>
            <div style={{ display: "flex", gap: "20px" }}>
              {/* Left Column - Mother Section */}
              <div style={{ flex: 1 }}>
                <div className="stage-section-subtitle">
               <strong>Mother</strong>   
                  </div>
                <table
                  className="perinatal-mother-table"
                  style={{ width: "100%" }}
                >
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Identification Type</td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["mother_identification_type"]
                        )}
                      </td>
                    </tr>
                    {currentEvent?.dataValues[formMapping.dataElements["mother_identification_type"]] === "ID_TYPE_SA" && (
                      <>
                        <tr>
                          <td style={{ fontWeight: "bold" }}>Identity Number</td>
                        </tr>
                        <tr>
                          <td style={{ width: "100%" }}>
                            {renderInputField(
                              formMapping.dataElements["mother_identity_number"]
                            )}
                          </td>
                        </tr>
                      </>
                    )}
                    {currentEvent?.dataValues[formMapping.dataElements["mother_identification_type"]] === "ID_TYPE_PASSPORT" && (
                      <>
                        <tr>
                          <td style={{ fontWeight: "bold" }}>Passport Number</td>
                        </tr>
                        <tr>
                          <td style={{ width: "100%" }}>
                            {renderInputField(
                              formMapping.dataElements["mother_passport_no"]
                            )}
                          </td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Date of Birth</td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["mother_dob"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>
                        Age of last birthday
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["mother_age"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>
                        Number of previous pregnancies - Live births
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["live_births"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>
                        Number of previous pregnancies - Still births
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["still_births"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>
                        Number of previous pregnancies - Abortions
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["g2_mother_prev_abortions"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>
                        Outcome of last previous pregnancy
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["last_preg_outcome"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>
                        Date of last previous delivery
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["previous_delivery_date"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>
                        First day of last menstrual period
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements[
                            "first_day_of_last_menstrual"
                          ]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>
                        Estimated duration of pregnancy (weeks)
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["preg_duration"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Method of delivery</td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["delivery_method"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>
                        Antenatal care two or more visits
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["antenatal_visits"]
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right Column - Child Section */}
              <div style={{ flex: 1 }}>
                <div className="stage-section-subtitle" > <strong> Child</strong></div>
                <table
                  className="perinatal-child-table"
                  style={{ width: "100%" }}
                >
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Type of death</td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["child_type_of_death"]
                        )}
                      </td>
                    </tr>
                    {currentEvent?.dataValues[formMapping.dataElements["child_type_of_death"]] === "TYPE_DEATH_STILL" && (
                      <>
                        <tr>
                          <td style={{ fontWeight: "bold" }}>
                            When did heartbeat cease?
                          </td>
                        </tr>
                        <tr>
                          <td style={{ width: "100%" }}>
                            {renderInputField(
                              formMapping.dataElements["heartbeat_ceased_type"]
                            )}
                          </td>
                        </tr>
                      </>
                    )}
                    <tr>
                      <td style={{ fontWeight: "bold" }}>
                        Birth weight (grams)
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["birth_weight"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>This birth was</td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["child_birth_type"]
                        )}
                      </td>
                    </tr>
                    {/* <tr>
                      <td style={{ fontWeight: "bold" }}>
                        Was this a still born
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["stillborn"]
                        )}
                      </td>
                    </tr> */}
                 
                    <tr>
                      <td style={{ fontWeight: "bold" }}>
                        If death occurred within 24h, number of hours alive
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["hours_newborn_survived"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Attendant at birth</td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["attendant_at_birth"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>Other Attendant</td>
                    </tr>
                    <tr>
                      <td style={{ width: "100%" }}>
                        {renderInputField(
                          formMapping.dataElements["attendant_at_birth_other"]
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cause of Death Section - Reusing G1 fields */}
            <div className="stage-section" style={{ marginTop: "20px" }}>
              <div className="stage-section-title">Cause of Death</div>
              <div className="stage-section-content">
                <table className="medical-data-table">
                  <tbody>
                    <tr>
                      <td
                        colSpan="3"
                        style={{
                          fontWeight: "bold",
                          textAlign: "left",
                          backgroundColor: "#f5f5f5",
                        }}
                      >
                        {t("reasonLeadingToDeath")}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ width: "90%" }}>{t("causeOfDeath")}</td>
                      <td>{t("underlying")}</td>
                    </tr>
                    <tr>
                      <td>
                        <div
                          style={{
                            fontWeight: "bold",
                            textAlign: "left",
                            marginBottom: "5px",
                          }}
                        >
                          Main disease or conditions in foetus or infant
                        </div>
                        <div className="two-fields-container">
                          {renderCauseOfDeathsInputField(
                            formMapping.dataElements["codA"],
                            formMapping.dataElements["codA_entityId"],
                            formMapping.dataElements["codA_underlying"],
                            formMapping.dataElements["codA_other_name"]
                          )}
                          {renderInputField(
                            formMapping.dataElements["codA_other_name"],
                            undefined,
                            "A (Free text)"
                          )}
                          <div style={{ width: "20%", margin: "5px" }}>
                            <Tooltip
                              className={"custom-tooltip"}
                              title={t("timeFromOnsetToDeath")}
                            >
                              <Button
                                style={{ width: "100%" }}
                                disabled={
                                  !currentEvent?.dataValues[
                                    formMapping.dataElements["codA"]
                                  ] || enrollmentStatus === "COMPLETED"
                                }
                                onClick={() => {
                                  setTimeToDeathModal(true);
                                  setTimeToDeath({
                                    causeId: formMapping.dataElements["codA"],
                                    causeLabel: "Immediate cause of death",
                                    timeInterval: currentEvent.dataValues[
                                      formMapping.dataElements["codA"]
                                    ]
                                      .split(",")
                                      .map((codeSelection) => ({
                                        code: codeSelection.split(" (")[0],
                                        time: codeSelection
                                          .split(" (")[1]
                                          ?.replace(")", ""),
                                      })),
                                  });
                                }}
                              >
                                <span
                                  style={{
                                    width: "100%",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "inline-block",
                                  }}
                                >
                                  {t("timeFromOnsetToDeath")}
                                </span>
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      </td>
                      <td>
                        {renderInputField(
                          formMapping.dataElements["codA_underlying"],
                          "underlying"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div
                          style={{
                            fontWeight: "bold",
                            textAlign: "left",
                            marginBottom: "5px",
                          }}
                        >
                          Other diseases or conditions in foetus or infant
                        </div>
                        <div className="two-fields-container">
                          {renderCauseOfDeathsInputField(
                            formMapping.dataElements["codB"],
                            formMapping.dataElements["codB_entityId"],
                            formMapping.dataElements["codB_underlying"],
                            formMapping.dataElements["codB_other_name"]
                          )}
                          {renderInputField(
                            formMapping.dataElements["codB_other_name"],
                            undefined,
                            "B (Free text)"
                          )}
                          <div style={{ width: "20%", margin: "5px" }}>
                            <Tooltip
                              className={"custom-tooltip"}
                              title={t("timeFromOnsetToDeath")}
                            >
                              <Button
                                style={{ width: "100%" }}
                                disabled={
                                  !currentEvent?.dataValues[
                                    formMapping.dataElements["codB"]
                                  ] || enrollmentStatus === "COMPLETED"
                                }
                                onClick={() => {
                                  setTimeToDeathModal(true);
                                  setTimeToDeath({
                                    causeId: formMapping.dataElements["codB"],
                                    causeLabel:
                                      "Condition leading to immediate cause",
                                    timeInterval: currentEvent.dataValues[
                                      formMapping.dataElements["codB"]
                                    ]
                                      .split(",")
                                      .map((codeSelection) => ({
                                        code: codeSelection.split(" (")[0],
                                        time: codeSelection
                                          .split(" (")[1]
                                          ?.replace(")", ""),
                                      })),
                                  });
                                }}
                              >
                                <span
                                  style={{
                                    width: "100%",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "inline-block",
                                  }}
                                >
                                  {t("timeFromOnsetToDeath")}
                                </span>
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      </td>
                      <td>
                        {renderInputField(
                          formMapping.dataElements["codB_underlying"],
                          "underlying"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div
                          style={{
                            fontWeight: "bold",
                            textAlign: "left",
                            marginBottom: "5px",
                          }}
                        >
                          Main maternal disease or condition affecting foetus or
                          infant
                        </div>
                        <div className="two-fields-container">
                          {renderCauseOfDeathsInputField(
                            formMapping.dataElements["codC"],
                            formMapping.dataElements["codC_entityId"],
                            formMapping.dataElements["codC_underlying"],
                            formMapping.dataElements["codC_other_name"]
                          )}
                          {renderInputField(
                            formMapping.dataElements["codC_other_name"],
                            undefined,
                            "C (Free text)"
                          )}
                          <div style={{ width: "20%", margin: "5px" }}>
                            <Tooltip
                              className={"custom-tooltip"}
                              title={t("timeFromOnsetToDeath")}
                            >
                              <Button
                                style={{ width: "100%" }}
                                disabled={
                                  !currentEvent?.dataValues[
                                    formMapping.dataElements["codC"]
                                  ] || enrollmentStatus === "COMPLETED"
                                }
                                onClick={() => {
                                  setTimeToDeathModal(true);
                                  setTimeToDeath({
                                    causeId: formMapping.dataElements["codC"],
                                    causeLabel:
                                      "Condition leading to previous cause",
                                    timeInterval: currentEvent.dataValues[
                                      formMapping.dataElements["codC"]
                                    ]
                                      .split(",")
                                      .map((codeSelection) => ({
                                        code: codeSelection.split(" (")[0],
                                        time: codeSelection
                                          .split(" (")[1]
                                          ?.replace(")", ""),
                                      })),
                                  });
                                }}
                              >
                                <span
                                  style={{
                                    width: "100%",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "inline-block",
                                  }}
                                >
                                  {t("timeFromOnsetToDeath")}
                                </span>
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      </td>
                      <td>
                        {renderInputField(
                          formMapping.dataElements["codC_underlying"],
                          "underlying"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div
                          style={{
                            fontWeight: "bold",
                            textAlign: "left",
                            marginBottom: "5px",
                          }}
                        >
                          Other maternal diseases or conditions affecting foetus
                          or infant
                        </div>
                        <div className="two-fields-container">
                          {renderCauseOfDeathsInputField(
                            formMapping.dataElements["codD"],
                            formMapping.dataElements["codD_entityId"],
                            formMapping.dataElements["codD_underlying"],
                            formMapping.dataElements["codD_other_name"]
                          )}
                          {renderInputField(
                            formMapping.dataElements["codD_other_name"],
                            undefined,
                            "D (Free text)"
                          )}
                          <div style={{ width: "20%", margin: "5px" }}>
                            <Tooltip
                              className={"custom-tooltip"}
                              title={t("timeFromOnsetToDeath")}
                            >
                              <Button
                                style={{ width: "100%" }}
                                disabled={
                                  !currentEvent?.dataValues[
                                    formMapping.dataElements["codD"]
                                  ] || enrollmentStatus === "COMPLETED"
                                }
                                onClick={() => {
                                  setTimeToDeathModal(true);
                                  setTimeToDeath({
                                    causeId: formMapping.dataElements["codD"],
                                    causeLabel: "Underlying cause of death",
                                    timeInterval: currentEvent.dataValues[
                                      formMapping.dataElements["codD"]
                                    ]
                                      .split(",")
                                      .map((codeSelection) => ({
                                        code: codeSelection.split(" (")[0],
                                        time: codeSelection
                                          .split(" (")[1]
                                          ?.replace(")", ""),
                                      })),
                                  });
                                }}
                              >
                                <span
                                  style={{
                                    width: "100%",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "inline-block",
                                  }}
                                >
                                  {t("timeFromOnsetToDeath")}
                                </span>
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      </td>
                      <td>
                        {renderInputField(
                          formMapping.dataElements["codD_underlying"],
                          "underlying"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan="2"
                        style={{
                          backgroundColor: "#f5f5f5",
                          textAlign: "right",
                        }}
                      >
                        <strong>Underlying Cause of Death processed by:</strong>{" "}
                        {renderInputField(
                          formMapping.dataElements["underlyingCOD_processed_by"]
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan="2"
                        style={{
                          backgroundColor: "#f5f5f5",
                          textAlign: "right",
                        }}
                      >
                        <strong>DORIS tool:</strong>
                        <Button
                          onClick={() => {
                            detectUnderlyingCauseOfDeath();
                          }}
                          disabled={
                            (currentEvent &&
                              currentEvent.dataValues[
                                formMapping.dataElements[
                                  "underlyingCOD_processed_by"
                                ]
                              ] &&
                              currentEvent.dataValues[
                                formMapping.dataElements[
                                  "underlyingCOD_processed_by"
                                ]
                              ] === "Manual") ||
                            enrollmentStatus === "COMPLETED"
                          }
                        >
                          {t("compute")}
                        </Button>
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan="2"
                        style={{
                          backgroundColor: "#f5f5f5",
                          textAlign: "right",
                        }}
                      >
                        Reason for Manual Code:
                        {renderInputField(
                          formMapping.dataElements[
                            "reason_of_manual_COD_selection"
                          ]
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          
          </div>
        )}
        {/* Manner of Death section - Now outside both G1 and G2 */}
        {formMapping.sections.find(
          ({ name }) => name === "Manner of death"
        ) && (
          <div className="stage-section">
            <div className="stage-section-title">{t("mannerOfDeath")}</div>
            <div className="stage-section-content">
              <table className="manner-death-table">
                <tbody>
                  <tr>
                    <td>{t("mannerOfDeath")}</td>
                    <td>
                      {renderInputField(
                        formMapping.dataElements["mannerOfDeath"]
                      )}
                    </td>
                  </tr>

                  {currentEvent?.dataValues[
                    formMapping.dataElements["mannerOfDeath"]
                  ] &&
                    currentEvent.dataValues[
                      formMapping.dataElements["mannerOfDeath"]
                    ] !== "0" && (
                      <>
                        <tr>
                          <td>{t("posisoning")}</td>
                          <td>
                            {renderInputField(
                              formMapping.dataElements["dateOfInjury"]
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>{t("describe")}</td>
                          <td>
                            {renderInputField(
                              formMapping.dataElements["externalCause"]
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>{t("occurrencePlace")}</td>
                          <td>
                            {renderInputField(
                              formMapping.dataElements["externalCause_place"]
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>{t("occurrenceSpecifyPlace")}</td>
                          <td>
                            {renderInputField(
                              formMapping.dataElements[
                                "externalCause_specifiedPlace"
                              ]
                            )}
                          </td>
                        </tr>
                      </>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* ...existing code for other sections... */}
      </div>
    </>
  );
};

const mapStateToProps = (state) => {
  return {
    metadata: state.metadata,
    data: state.data,
  };
};
const mapDispatchToProps = { mutateEvent, mutateDataValue, initNewEvent };

export default connect(mapStateToProps, mapDispatchToProps)(Stage);
