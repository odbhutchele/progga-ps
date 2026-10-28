"use client";

import {
  deleteClass,
  deleteSection,
  deleteAnnouncement,
  deleteExam,
  deleteEvent,
  deleteLesson,
  deleteStudent,
  deleteSubject,
  deleteTeacher,
} from "@/lib/actions";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { toast } from "react-toastify";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { FormContainerProps } from "./FormContainer";

const deleteActionMap = {
  subject: deleteSubject,
  class: deleteClass,
  section: deleteSection,
  teacher: deleteTeacher,
  student: deleteStudent,
  exam: deleteExam,
  lesson: deleteLesson,
  event: deleteEvent,
  announcement: deleteAnnouncement,
};

type DeleteAction = (typeof deleteActionMap)[keyof typeof deleteActionMap];

const DeleteForm = ({
  action,
  id,
  table,
  onDeleted,
}: {
  action: DeleteAction;
  id: number | string;
  table: FormContainerProps["table"];
  onDeleted: () => void;
}) => {
  const [state, formAction] = useFormState(action, {
    success: false,
    error: false,
  });
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast(`${table} has been deleted!`);
      onDeleted();
      router.refresh();
    }
  }, [state.success, table, onDeleted, router]);

  return (
    <form action={formAction} className="p-6 flex flex-col gap-5">
      <input type="text" name="id" value={id} readOnly hidden />
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <p className="font-semibold text-slate-800">Delete {table}?</p>
        <p className="text-sm text-slate-500">All data will be permanently lost. This action cannot be undone.</p>
      </div>
      {state.error && "message" in state && state.message && (
        <p className="text-sm text-red-600 text-center">{state.message}</p>
      )}
      <button className="bg-red-600 hover:bg-red-700 text-white py-2.5 px-6 rounded-xl font-semibold text-sm w-max self-center transition-colors">
        Yes, delete
      </button>
    </form>
  );
};

// USE LAZY LOADING

// import TeacherForm from "./forms/TeacherForm";
// import StudentForm from "./forms/StudentForm";

const TeacherForm = dynamic(() => import("./forms/TeacherForm"), {
  loading: () => <h1>Loading...</h1>,
});
const StudentForm = dynamic(() => import("./forms/StudentForm"), {
  loading: () => <h1>Loading...</h1>,
});
const SubjectForm = dynamic(() => import("./forms/SubjectForm"), {
  loading: () => <h1>Loading...</h1>,
});
const ClassForm = dynamic(() => import("./forms/ClassForm"), {
  loading: () => <h1>Loading...</h1>,
});
const SectionForm = dynamic(() => import("./forms/SectionForm"), {
  loading: () => <h1>Loading...</h1>,
});
const ExamForm = dynamic(() => import("./forms/ExamForm"), {
  loading: () => <h1>Loading...</h1>,
});
// TODO: OTHER FORMS

const forms: {
  [key: string]: (
    setOpen: Dispatch<SetStateAction<boolean>>,
    type: "create" | "update",
    data?: any,
    relatedData?: any
  ) => JSX.Element;
} = {
  subject: (setOpen, type, data, relatedData) => (
    <SubjectForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  class: (setOpen, type, data, relatedData) => (
    <ClassForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  section: (setOpen, type, data, relatedData) => (
    <SectionForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  teacher: (setOpen, type, data, relatedData) => (
    <TeacherForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  student: (setOpen, type, data, relatedData) => (
    <StudentForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
  ),
  exam: (setOpen, type, data, relatedData) => (
    <ExamForm
      type={type}
      data={data}
      setOpen={setOpen}
      relatedData={relatedData}
    />
    // TODO OTHER LIST ITEMS
  ),
};

const FormModal = ({
  table,
  type,
  data,
  id,
  relatedData,
}: FormContainerProps & { relatedData?: any }) => {
  const triggerClass =
    type === "create"
      ? "w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
      : type === "update"
      ? "w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"
      : "w-7 h-7 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg";
  const TriggerIcon = type === "create" ? Plus : type === "update" ? Pencil : Trash2;

  const [open, setOpen] = useState(false);

  const Form = () => {
    if (type === "delete" && id) {
      const action = deleteActionMap[table as keyof typeof deleteActionMap];
      return action ? (
        <DeleteForm action={action} id={id} table={table} onDeleted={() => setOpen(false)} />
      ) : (
        <p className="p-6 text-sm text-red-600">Delete is not available for {table}.</p>
      );
    }

    const renderForm = forms[table];
    return type === "create" || type === "update"
      ? renderForm
        ? renderForm(setOpen, type, data, relatedData)
        : <p className="p-6 text-sm text-red-600">Form is not available for {table}.</p>
      : "Form not found!";
  };

  return (
    <>
      <button
        className={`flex items-center justify-center transition-colors ${triggerClass}`}
        onClick={() => setOpen(true)}
        title={type}
      >
        <TriggerIcon size={type === "create" ? 16 : 14} />
      </button>
      {open &&
        createPortal(
          <div className="w-screen h-screen fixed left-0 top-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl relative w-[95%] max-w-5xl max-h-[90vh] overflow-y-auto">
              <button
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors z-10"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
              <Form />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default FormModal;
