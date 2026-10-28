"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import InputField from "../InputField";
import Image from "next/image";
import { Dispatch, SetStateAction, useState } from "react";
import { studentSchema, StudentSchema } from "@/lib/formValidationSchemas";
import { createStudent, updateStudent } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { CldUploadWidget } from "next-cloudinary";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const StudentForm = ({
  type,
  data,
  setOpen,
  relatedData,
}: {
  type: "create" | "update";
  data?: any;
  setOpen?: Dispatch<SetStateAction<boolean>>;
  relatedData?: any;
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<StudentSchema>({
    resolver: zodResolver(studentSchema),
  });

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState<string | undefined>(data?.img);

  const router = useRouter();
  const { classes = [] } = relatedData || {};

  const onSubmit = handleSubmit(async (formData) => {
    setSubmitting(true);
    setServerError(null);
    try {
      if (type === "create") {
        const result = await createStudent(
          { success: false, error: false },
          { ...formData }
        );
        if (result.success && result.id) {
          toast("Student created successfully!");
          if (setOpen) setOpen(false);
          router.push(`/list/students/${result.id}`);
        } else {
          setServerError(result.message ?? "Something went wrong. Please check all fields and try again.");
        }
      } else {
        const result = await updateStudent(
          { success: false, error: false },
          { ...formData }
        );
        if (result.success) {
          toast("Student updated successfully!");
          if (setOpen) {
            setOpen(false);
            router.refresh();
          } else {
            router.push("/list/students");
          }
        } else {
          setServerError(result.message ?? "Something went wrong. Please check all fields and try again.");
        }
      }
    } catch {
      setServerError("Something went wrong. Please check all fields and try again.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">
        {type === "create" ? "Add New Student" : "Update Student"}
      </h1>

      {type === "create" && (
        <p className="text-xs text-blue-500 bg-blue-50 border border-blue-100 rounded-md p-3">
          Student ID and password are auto-generated on creation. The student logs in using their ID.
        </p>
      )}

      {/* Personal info section */}
      <section>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">
          Personal Information
        </p>

        {/* Photo Upload */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-3">
            {process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? (
              <CldUploadWidget
                uploadPreset="progga_preset"
                options={{ maxFiles: 1, clientAllowedFormats: ["image"] }}
                onSuccess={(result: any) => {
                  setImgUrl(result.info.secure_url);
                  setValue("img", result.info.secure_url);
                }}
              >
                {({ open }) => {
                  return (
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => open()}>
                      <div className="w-20 h-20 rounded-md overflow-hidden bg-white border border-gray-200 flex-shrink-0 relative shadow-sm">
                        <Image
                          src={imgUrl || "/noAvatar.png"}
                          alt="Profile Photo"
                          fill
                          className="object-contain p-1"
                        />
                      </div>
                      <span className="text-sm font-medium text-blue-600 hover:underline">
                        Upload Photo
                      </span>
                    </div>
                  );
                }}
              </CldUploadWidget>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-md overflow-hidden bg-white border border-gray-200 flex-shrink-0 relative shadow-sm">
                  <Image
                    src={imgUrl || "/noAvatar.png"}
                    alt="Profile Photo"
                    fill
                    className="object-contain p-1"
                  />
                </div>
                <span className="text-sm text-gray-400">
                  Photo upload unavailable
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="First Name"
            name="name"
            defaultValue={data?.name}
            register={register}
            error={errors.name}
          />
          <InputField
            label="Last Name"
            name="surname"
            defaultValue={data?.surname}
            register={register}
            error={errors.surname}
          />
          <InputField
            label="Phone"
            name="phone"
            defaultValue={data?.phone}
            register={register}
            error={errors.phone}
          />
          <InputField
            label="Address"
            name="address"
            defaultValue={data?.address}
            register={register}
            error={errors.address}
          />
          <InputField
            label="Birthday"
            name="birthday"
            defaultValue={data?.birthday ? new Date(data.birthday).toISOString().split("T")[0] : ""}
            register={register}
            error={errors.birthday}
            type="date"
          />

          {/* Blood Type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Blood Type</label>
            <select
              className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
              {...register("bloodType")}
              defaultValue={data?.bloodType || ""}
            >
              <option value="">Select blood type</option>
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
            {errors.bloodType?.message && (
              <p className="text-xs text-red-400">{errors.bloodType.message}</p>
            )}
          </div>

          {/* Sex */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Gender</label>
            <select
              className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
              {...register("sex")}
              defaultValue={data?.sex}
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
            {errors.sex?.message && (
              <p className="text-xs text-red-400">{errors.sex.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Academic section */}
      <section>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">
          Academic Details
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Class */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Class</label>
            <select
              className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
              {...register("classId")}
              defaultValue={data?.classId}
            >
              <option value="">Select class</option>
              {classes.map(
                (cls: {
                  id: number;
                  name: string;
                  capacity: number;
                  _count: { students: number };
                }) => (
                  <option value={cls.id} key={cls.id}>
                    Class {cls.name} — {cls._count.students}/{cls.capacity} seats
                  </option>
                )
              )}
            </select>
            {errors.classId?.message && (
              <p className="text-xs text-red-400">{errors.classId.message}</p>
            )}
          </div>

          {/* Section */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">
              Section {classes?.some((c: any) => c.sections?.length > 0) && (
                <span className="text-blue-600 font-medium">(select or type)</span>
              )}
            </label>
            <input
              type="text"
              list="sections-datalist"
              placeholder="e.g. A, B, Science, Arts"
              className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
              {...register("section")}
              defaultValue={data?.section ?? ""}
            />
            <datalist id="sections-datalist">
              {classes?.flatMap((c: any) => c.sections || []).map((s: any) => (
                <option key={s.id} value={s.name}>
                  Section {s.name}
                </option>
              ))}
            </datalist>
            {errors.section?.message && (
              <p className="text-xs text-red-400">{errors.section.message}</p>
            )}
          </div>

          {/* Custom Tuition Fee */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">
              Custom Tuition Fee <span className="text-gray-400 font-normal">(leave blank for class default)</span>
            </label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 800"
              className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
              {...register("customTuitionFee")}
              defaultValue={data?.customTuitionFee ?? ""}
            />
            {errors.customTuitionFee?.message && (
              <p className="text-xs text-red-400">{String(errors.customTuitionFee.message)}</p>
            )}
          </div>

          {/* Admission Fee */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Admission Fee</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 1000"
              className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
              {...register("admissionFee")}
              defaultValue={data?.admissionFee ?? ""}
            />
            {errors.admissionFee?.message && (
              <p className="text-xs text-red-400">{String(errors.admissionFee.message)}</p>
            )}
          </div>

          <InputField
            label="Father's Name"
            name="fatherName"
            defaultValue={data?.fatherName}
            register={register}
            error={errors.fatherName}
          />
          <InputField
            label="Mother's Name"
            name="motherName"
            defaultValue={data?.motherName}
            register={register}
            error={errors.motherName}
          />
          <InputField
            label="Roll No"
            name="rollNo"
            defaultValue={data?.rollNo ?? ""}
            register={register}
            error={errors.rollNo}
            type="number"
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Group</label>
            <input
              type="text"
              placeholder="e.g. COMMON, SCIENCE"
              className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
              {...register("group")}
              defaultValue={data?.group ?? ""}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Shift</label>
            <input
              type="text"
              placeholder="e.g. Day, Morning"
              className="ring-[1.5px] ring-gray-300 p-2 rounded-md text-sm w-full"
              {...register("shift")}
              defaultValue={data?.shift ?? ""}
            />
          </div>
          <InputField
            label="Guardian Name"
            name="guardianName"
            defaultValue={data?.guardianName}
            register={register}
            error={errors.guardianName}
          />
          <InputField
            label="Guardian Phone"
            name="guardianPhone"
            defaultValue={data?.guardianPhone}
            register={register}
            error={errors.guardianPhone}
          />
        </div>
      </section>

      {/* Admission Details */}
      <section>
        <h3 className="text-sm font-semibold text-gray-600 mb-3 pb-1 border-b border-gray-100">Admission Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Father's Name (English)" name="fatherNameEn" defaultValue={data?.fatherNameEn} register={register} error={errors.fatherNameEn} />
          <InputField label="Father's Phone" name="fatherPhone" defaultValue={data?.fatherPhone} register={register} error={errors.fatherPhone} />
          <InputField label="Father's NID" name="fatherNid" defaultValue={data?.fatherNid} register={register} error={errors.fatherNid} />
          <InputField label="Father's Address" name="fatherAddress" defaultValue={data?.fatherAddress} register={register} error={errors.fatherAddress} />
          <InputField label="Father's Upazila/Thana" name="fatherUpazila" defaultValue={data?.fatherUpazila} register={register} error={errors.fatherUpazila} />
          <InputField label="Father's Work Address" name="fatherWorkAddress" defaultValue={data?.fatherWorkAddress} register={register} error={errors.fatherWorkAddress} />
          <InputField label="Mother's Name (English)" name="motherNameEn" defaultValue={data?.motherNameEn} register={register} error={errors.motherNameEn} />
          <InputField label="Mother's NID" name="motherNid" defaultValue={data?.motherNid} register={register} error={errors.motherNid} />
          <InputField label="Birth Registration No." name="birthRegNo" defaultValue={data?.birthRegNo} register={register} error={errors.birthRegNo} />
          <InputField label="Religion" name="religion" defaultValue={data?.religion} register={register} error={errors.religion} />
        </div>
      </section>

      {data && (
        <input type="hidden" {...register("id")} defaultValue={data.id} />
      )}

      {serverError && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-md p-3">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white p-2 rounded-md font-medium transition-colors"
      >
        {submitting
          ? type === "create" ? "Creating..." : "Saving..."
          : type === "create" ? "Create Student" : "Save Changes"}
      </button>
    </form>
  );
};

export default StudentForm;
