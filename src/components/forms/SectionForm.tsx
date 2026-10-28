"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import InputField from "../InputField";
import { sectionSchema, SectionSchema } from "@/lib/formValidationSchemas";
import { createSection, updateSection } from "@/lib/actions";
import { useFormState } from "react-dom";
import { Dispatch, SetStateAction, useEffect } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

const SectionForm = ({
  type,
  data,
  setOpen,
  relatedData,
}: {
  type: "create" | "update";
  data?: any;
  setOpen: Dispatch<SetStateAction<boolean>>;
  relatedData?: any;
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SectionSchema>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      classId: data?.classId,
      name: data?.name ?? "",
      capacity: data?.capacity,
      supervisorId: data?.supervisorId ?? "",
      id: data?.id,
    },
  });

  const [state, formAction] = useFormState(
    type === "create" ? createSection : updateSection,
    {
      success: false,
      error: false,
    }
  );

  const onSubmit = handleSubmit((formData) => {
    formAction(formData);
  });

  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast(`Section has been ${type === "create" ? "created" : "updated"}!`);
      setOpen(false);
      router.refresh();
    } else if (state.error && state.message) {
      toast.error(state.message);
    }
  }, [state, router, type, setOpen]);

  const teachers = relatedData?.teachers || [];

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      <h1 className="text-xl font-bold text-slate-800">
        {type === "create" ? "Add New Section" : "Update Section"}
      </h1>

      {/* Hidden Fields */}
      <input type="hidden" {...register("classId")} value={data?.classId} />
      {data?.id && (
        <input type="hidden" {...register("id")} value={data?.id} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Section Name */}
        <div>
          <InputField
            label="Section Name (e.g. A, B, Padma)"
            name="name"
            defaultValue={data?.name}
            register={register}
            error={errors?.name}
          />
        </div>

        {/* Capacity */}
        <div>
          <InputField
            label="Section Capacity (Optional)"
            name="capacity"
            type="number"
            defaultValue={data?.capacity}
            register={register}
            error={errors?.capacity}
          />
        </div>

        {/* Supervisor */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-xs text-slate-600 font-semibold">
            Section Supervisor / Class Teacher (Optional)
          </label>
          <select
            className="ring-1 ring-slate-200 p-2.5 rounded-xl text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            {...register("supervisorId")}
            defaultValue={data?.supervisorId ?? ""}
          >
            <option value="">No supervisor assigned</option>
            {teachers.map(
              (teacher: { id: string; name: string; surname: string }) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} {teacher.surname}
                </option>
              )
            )}
          </select>
          {errors.supervisorId?.message && (
            <p className="text-xs text-red-500 font-medium">
              {errors.supervisorId.message.toString()}
            </p>
          )}
        </div>
      </div>

      {state.error && state.message && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {state.message}
        </div>
      )}

      <button
        type="submit"
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold p-2.5 rounded-xl transition-colors shadow-sm"
      >
        {type === "create" ? "Create Section" : "Save Changes"}
      </button>
    </form>
  );
};

export default SectionForm;
