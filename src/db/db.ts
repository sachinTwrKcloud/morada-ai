import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();

const sql = postgres(encodeURI(process.env.DATABASE_URL || ""), {
    transform: postgres.camel,
    debug: process.env.DB_DEBUG === "true" && ((_connection, query, parameters) => {
        console.log("query:", query);
        console.log("parameters:", parameters);
    }),
});

export default sql;
