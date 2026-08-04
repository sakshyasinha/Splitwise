import request from 'supertest';
import assert from "node:assert/strict";
import app from "../server.js";
import { response } from 'express';

describe("Expense API Integration",()=>{

    it("should register a test user",async()=>{
        const res=await request(app)
        .post("/api/auth/register")
        .send({
            name:"Test User",
            email: `test${Date.now()}@example.com`,
            password:"password"
        })
        console.log(res.statusCode);
console.log(res.body);
        assert.equal(res.statusCode,201);
    });
        });